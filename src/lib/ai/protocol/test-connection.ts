/**
 * 测试连接 - 用极简对话验证端点 + key + model 是否能正常工作
 *
 * 灵感: 天命的 ProbeMinimalChatAsync
 *
 * 当模型列表 API 不可用时,用户手动输入模型 ID,可以用这个测试是否能跑通
 */

import { findBlueprint } from './presets'
import { getCustomBlueprints } from './storage'
import { prepareRequest, extractResponse } from './executor'
import type { ProtocolBlueprint, NormalizedRequest } from './types'
import { isTauriEnv } from '../../tauri-api'
import { invoke } from '@tauri-apps/api/core'
import { generateCandidateBaseUrls, classifyHttpError, STANDARD_BROWSER_HEADERS } from './endpoint-discovery'

export interface TestResult {
    success: boolean
    workingBaseUrl?: string
    response?: string
    error?: string
    elapsed?: number
}

/**
 * 测试一个 (协议, baseURL, key, model) 组合是否能正常对话
 *
 * 会自动尝试多个 baseURL 候选 (类似 listModels),
 * 找到第一个能成功对话的端点
 */
export async function testConnection(
    blueprintId: string,
    baseUrl: string,
    apiKey: string,
    model: string
): Promise<TestResult> {
    const customs = getCustomBlueprints()
    const blueprint = findBlueprint(blueprintId, customs)
    if (!blueprint) {
        return { success: false, error: '协议蓝图不存在' }
    }
    if (!model) {
        return { success: false, error: '请指定模型 ID' }
    }
    if (!baseUrl) {
        return { success: false, error: '请填入 Base URL' }
    }
    if (!apiKey && blueprint.auth.location !== 'none') {
        return { success: false, error: '请填入 API Key' }
    }

    const candidates = generateCandidateBaseUrls(baseUrl)
    if (candidates.length === 0) {
        return { success: false, error: 'Base URL 格式错误' }
    }

    console.log(`[testConnection] 测试 ${candidates.length} 个候选: ${candidates.join(', ')}`)

    const startedAt = Date.now()
    const errors: string[] = []

    // 并行测试所有候选
    const tasks = candidates.map(c => testSingleCandidate(blueprint, c, apiKey, model))
    const results = await Promise.all(tasks)

    // 找第一个成功的
    for (const r of results) {
        if (r.success) {
            return {
                success: true,
                workingBaseUrl: r.baseUrl,
                response: r.response?.slice(0, 200),
                elapsed: Date.now() - startedAt
            }
        } else if (r.error) {
            errors.push(`[${r.baseUrl}] ${r.error}`)
        }
    }

    return {
        success: false,
        error: errors[0] || '所有候选都失败',
        elapsed: Date.now() - startedAt
    }
}

async function testSingleCandidate(
    blueprint: ProtocolBlueprint,
    baseUrl: string,
    apiKey: string,
    model: string
): Promise<{ baseUrl: string; success: boolean; response?: string; error?: string }> {
    const req: NormalizedRequest = {
        messages: [
            { role: 'user', content: 'ping' }
        ],
        model,
        temperature: 0.1,
        maxTokens: 5,
        stream: false
    }

    try {
        const prepared = prepareRequest({ blueprint, baseUrl, apiKey }, req)

        // 加上浏览器伪装头 (避免 WAF)
        const headers: Record<string, string> = {
            ...STANDARD_BROWSER_HEADERS,
            ...prepared.headers
        }

        const text = await sendRaw(prepared.url, 'POST', headers, prepared.body)

        // 尝试解析
        try {
            const data = JSON.parse(text)
            const response = extractResponse(blueprint, data)
            return { baseUrl, success: true, response }
        } catch {
            return { baseUrl, success: false, error: '响应不是 JSON' }
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : '请求失败'
        return { baseUrl, success: false, error: msg }
    }
}

/**
 * HTTP 调用 (与 client.ts 共享逻辑,但避免循环依赖)
 */
async function sendRaw(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: string
): Promise<string> {
    if (isTauriEnv()) {
        const resp = await invoke<{ status: number; body: string; ok: boolean }>('http_proxy', {
            request: { url, method, headers, body }
        })
        if (!resp.ok) {
            throw new Error(classifyHttpError(resp.status, resp.body).message)
        }
        return resp.body
    }

    // 浏览器走 /api/proxy
    const resp = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, method, headers, body })
    })
    const data = await resp.json()
    if (!data.ok) {
        if (data.status === 500 && data.error) throw new Error(`无法连接: ${data.error}`)
        throw new Error(classifyHttpError(data.status, data.body).message)
    }
    return data.body
}
