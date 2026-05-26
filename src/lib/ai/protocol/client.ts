/**
 * 协议蓝图驱动的 LLM 客户端
 *
 * 替换硬编码的 chatCompletion / streamChatCompletion
 */

import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { isTauriEnv } from '../../tauri-api'
import { findBlueprint } from './presets'
import {
    prepareRequest,
    extractResponse,
    extractChunk,
    renderUrl,
    extractModelsFromResponse
} from './executor'
import type { NormalizedMessage, NormalizedRequest, ProtocolBlueprint } from './types'
import {
    getActiveConfig,
    getCustomBlueprints
} from './storage'

export interface ChatOptions {
    model?: string
    temperature?: number
    maxTokens?: number
}

export interface StreamCallbacks {
    onChunk: (text: string) => void
    onDone: () => void
    onError: (error: string) => void
}

// ========== 解析当前激活的蓝图 ==========

export function getActiveBlueprint(): { blueprint: ProtocolBlueprint; baseUrl: string; apiKey: string; model: string } | null {
    const cfg = getActiveConfig()
    const customs = getCustomBlueprints()
    const blueprint = findBlueprint(cfg.blueprintId, customs)
    if (!blueprint) return null

    const baseUrl = cfg.baseUrl || blueprint.defaultBaseUrl || ''
    return { blueprint, baseUrl, apiKey: cfg.apiKey, model: cfg.model }
}

// ========== 非流式对话 ==========

export async function chatCompletion(
    messages: NormalizedMessage[],
    options?: ChatOptions
): Promise<string> {
    const active = getActiveBlueprint()
    if (!active) {
        throw new Error('未配置 AI 协议蓝图,请先在设置中选择')
    }

    const { blueprint, baseUrl, apiKey } = active
    const model = options?.model || active.model

    if (!model) throw new Error('未指定模型')
    if (!baseUrl) throw new Error('未配置 baseUrl')
    if (!apiKey && blueprint.auth.location !== 'none') {
        throw new Error('请先配置 API Key')
    }

    const req: NormalizedRequest = {
        messages,
        model,
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 2048,
        stream: false
    }

    const prepared = prepareRequest({ blueprint, baseUrl, apiKey }, req)

    // 发起请求
    const responseBody = await sendRequest(prepared.url, 'POST', prepared.headers, prepared.body)
    const data = JSON.parse(responseBody)

    return extractResponse(blueprint, data)
}

// ========== 流式对话 ==========

export async function streamChatCompletion(
    messages: NormalizedMessage[],
    callbacks: StreamCallbacks,
    options?: ChatOptions
): Promise<void> {
    const safe = {
        onChunk: callbacks?.onChunk || (() => {}),
        onDone: callbacks?.onDone || (() => {}),
        onError: callbacks?.onError || ((e: string) => console.error(e))
    }

    const active = getActiveBlueprint()
    if (!active) {
        safe.onError('未配置 AI 协议蓝图')
        return
    }

    const { blueprint, baseUrl, apiKey } = active
    const model = options?.model || active.model

    const req: NormalizedRequest = {
        messages,
        model,
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 2048,
        stream: true
    }

    const prepared = prepareRequest({ blueprint, baseUrl, apiKey }, req)

    // 通用 SSE 解析
    const parseChunk = (rawChunk: string) => {
        const lines = rawChunk.split('\n')
        for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]' || !data) continue
            try {
                const json = JSON.parse(data)
                const text = extractChunk(blueprint, json)
                if (text) safe.onChunk(text)
            } catch {
                // 忽略
            }
        }
    }

    if (isTauriEnv()) {
        let unlistenChunk: UnlistenFn | null = null
        let unlistenDone: UnlistenFn | null = null
        let unlistenError: UnlistenFn | null = null

        try {
            unlistenChunk = await listen<string>('stream-chunk', (e) => parseChunk(e.payload))
            unlistenDone = await listen('stream-done', () => safe.onDone())
            unlistenError = await listen<string>('stream-error', (e) => safe.onError(e.payload))

            await invoke('http_stream', {
                request: { url: prepared.url, method: 'POST', headers: prepared.headers, body: prepared.body }
            })
        } finally {
            unlistenChunk?.()
            unlistenDone?.()
            unlistenError?.()
        }
    } else {
        // 浏览器: 走 /api/proxy (非流式) - 因为 fetch streaming 跨域复杂,简化为整段返回
        try {
            const fullText = await sendRequest(prepared.url, 'POST', prepared.headers, prepared.body)
            // 模拟流式
            const data = JSON.parse(fullText)
            const content = extractResponse(blueprint, data)
            if (content) safe.onChunk(content)
            safe.onDone()
        } catch (e) {
            safe.onError(e instanceof Error ? e.message : '未知错误')
        }
    }
}

// ========== 模型扫描 (并行候选探测,借鉴天命算法) ==========

import {
    generateCandidateBaseUrls,
    isHtmlResponse,
    STANDARD_BROWSER_HEADERS,
    classifyHttpError
} from './endpoint-discovery'

interface SingleEndpointResult {
    baseUrl: string
    success: boolean
    models: Array<{ id: string; name: string; contextLength?: number; description?: string }>
    error?: string
    httpStatus?: number
}

export async function listModelsByBlueprint(
    blueprint: ProtocolBlueprint,
    baseUrl: string,
    apiKey: string
): Promise<{
    success: boolean
    models: Array<{ id: string; name: string; contextLength?: number; description?: string }>
    error?: string
    debug?: { url: string; status?: number; sample?: string; tried?: string[] }
    suggestedBaseUrl?: string
}> {
    if (!blueprint.listModels?.endpoint) {
        return { success: false, models: [], error: '该协议未配置模型扫描端点' }
    }

    if (!baseUrl) {
        return { success: false, models: [], error: '请先填入 Base URL' }
    }

    // 1. 生成候选 baseURL 列表
    const candidates = generateCandidateBaseUrls(baseUrl)
    if (candidates.length === 0) {
        return { success: false, models: [], error: 'URL 格式错误' }
    }

    console.log(`[scanModels] 生成 ${candidates.length} 个候选: ${candidates.join(', ')}`)

    // 2. 并行扫描所有候选
    const tasks = candidates.map(c => testSingleBaseUrl(blueprint, c, apiKey))
    const results = await Promise.all(tasks)

    // 3. 取成功结果中 model 数量最多的 (符合天命算法)
    const successResults = results.filter(r => r.success && r.models.length > 0)

    if (successResults.length === 0) {
        // 全部失败,挑最有信息量的错误返回
        // 优先级: 鉴权 > HTTP 错误 > 网络错误
        const sortedFailures = results
            .filter(r => !r.success)
            .sort((a, b) => {
                const score = (r: SingleEndpointResult) => {
                    if (!r.httpStatus) return 0
                    if (r.httpStatus === 401 || r.httpStatus === 403) return 100  // 鉴权问题最有用
                    if (r.httpStatus === 200) return 90  // 200 但解析失败,信息也很重要
                    if (r.httpStatus >= 400) return 50
                    return 10
                }
                return score(b) - score(a)
            })

        const best = sortedFailures[0]
        return {
            success: false,
            models: [],
            error: best?.error || '所有候选端点均失败',
            debug: {
                url: best?.baseUrl || candidates[0],
                status: best?.httpStatus,
                tried: candidates
            }
        }
    }

    // 取 model 最多的
    const winner = successResults.sort((a, b) => b.models.length - a.models.length)[0]
    console.log(`[scanModels] ✅ 胜出端点: ${winner.baseUrl} (${winner.models.length} 个模型)`)

    // 如果用户原始输入不是这个,提示采用建议
    const userInput = baseUrl.replace(/\/+$/, '')
    const suggestedBaseUrl = winner.baseUrl !== userInput ? winner.baseUrl : undefined

    return {
        success: true,
        models: winner.models,
        suggestedBaseUrl
    }
}

/**
 * 测试单个候选 baseURL
 */
async function testSingleBaseUrl(
    blueprint: ProtocolBlueprint,
    baseUrl: string,
    apiKey: string
): Promise<SingleEndpointResult> {
    if (!blueprint.listModels?.endpoint) {
        return { baseUrl, success: false, models: [], error: '协议未配置 listModels' }
    }

    const url = renderUrl(blueprint.listModels.endpoint, { baseUrl, key: apiKey })

    // 构建鉴权头 (带浏览器伪装,避免 WAF)
    const headers: Record<string, string> = {
        ...STANDARD_BROWSER_HEADERS,
        'Content-Type': 'application/json'
    }

    // 同时尝试 Authorization: Bearer 和 X-Api-Key (天命策略)
    if (apiKey) {
        if (blueprint.auth.location === 'header') {
            const v = (blueprint.auth.valuePattern || '{key}').replace(/\{key\}/g, apiKey)
            headers[blueprint.auth.name || 'Authorization'] = v
            // 双保险: 也加上 X-Api-Key (中转服务有的认这个)
            if (blueprint.auth.name !== 'X-Api-Key' && blueprint.auth.name !== 'x-api-key') {
                headers['X-Api-Key'] = apiKey
            }
        }
    }
    if (blueprint.auth.extra) Object.assign(headers, blueprint.auth.extra)

    let finalUrl = url
    if (blueprint.auth.location === 'query' && apiKey) {
        const sep = url.includes('?') ? '&' : '?'
        finalUrl = `${url}${sep}${blueprint.auth.name || 'key'}=${encodeURIComponent(apiKey)}`
    }

    try {
        const text = await sendRequest(finalUrl, 'GET', headers, null)

        // HTML 响应 = 走错路径,落到前端页面
        if (isHtmlResponse(text)) {
            return {
                baseUrl,
                success: false,
                models: [],
                error: '端点返回 HTML (前端页面),非 API',
                httpStatus: 200
            }
        }

        let data: unknown
        try {
            data = JSON.parse(text)
        } catch {
            return {
                baseUrl,
                success: false,
                models: [],
                error: '响应不是 JSON',
                httpStatus: 200
            }
        }

        const models = blueprint.listModels.extractor
            ? blueprint.listModels.extractor(data)
            : (blueprint.schema ? extractModelsFromResponse(data, blueprint.schema) : [])

        if (models.length === 0) {
            return {
                baseUrl,
                success: false,
                models: [],
                error: '响应有效但解析到 0 个模型',
                httpStatus: 200
            }
        }

        return { baseUrl, success: true, models }
    } catch (e) {
        const msg = e instanceof Error ? e.message : '请求失败'
        // 提取 HTTP 状态码
        const statusMatch = msg.match(/HTTP (\d{3})/)
        const status = statusMatch ? parseInt(statusMatch[1]) : undefined

        return {
            baseUrl,
            success: false,
            models: [],
            error: msg,
            httpStatus: status
        }
    }
}

// ========== 请求工具 ==========

async function sendRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: string | null
): Promise<string> {
    if (isTauriEnv()) {
        const resp = await invoke<{ status: number; body: string; ok: boolean }>('http_proxy', {
            request: { url, method, headers, body }
        })
        if (!resp.ok) {
            throw new Error(extractUpstreamError(resp.status, resp.body))
        }
        return resp.body
    }

    // 浏览器: 走 /api/proxy
    const resp = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, method, headers, body })
    })

    let data: { status: number; body: string; ok: boolean; error?: string }
    try {
        data = await resp.json()
    } catch {
        throw new Error(`代理响应不是 JSON (HTTP ${resp.status})`)
    }

    if (!data.ok) {
        if (data.error && data.status === 500) {
            // 代理本身的错误 (网络/DNS/超时等)
            throw new Error(`无法连接: ${data.error}`)
        }
        throw new Error(extractUpstreamError(data.status, data.body))
    }

    return data.body
}

/**
 * 从上游错误响应中提取人类可读的错误信息
 */
function extractUpstreamError(status: number, body: string): string {
    const sample = String(body || '').slice(0, 600)

    // 试着解析 JSON 错误
    try {
        const j = JSON.parse(sample)
        const msg = j?.error?.message || j?.message || j?.error || j?.detail || j?.msg
        if (msg) return `HTTP ${status}: ${msg}`
    } catch {
        // 不是 JSON,保留原文
    }

    if (status === 401 || status === 403) {
        return `HTTP ${status} 鉴权失败,请检查 API Key 是否正确`
    }
    if (status === 404) {
        return `HTTP 404 端点不存在,请检查 Base URL 是否正确`
    }
    if (status === 429) {
        return `HTTP 429 请求过于频繁`
    }
    if (status >= 500) {
        return `HTTP ${status} 上游服务器错误: ${sample.slice(0, 200)}`
    }

    return `HTTP ${status}: ${sample.slice(0, 200)}`
}
