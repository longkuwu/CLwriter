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

// ========== 模型扫描 (基于蓝图) ==========

export async function listModelsByBlueprint(
    blueprint: ProtocolBlueprint,
    baseUrl: string,
    apiKey: string
): Promise<{ success: boolean; models: Array<{ id: string; name: string; contextLength?: number; description?: string }>; error?: string }> {
    if (!blueprint.listModels?.endpoint) {
        return { success: false, models: [], error: '该协议不支持模型扫描' }
    }

    const url = renderUrl(blueprint.listModels.endpoint, { baseUrl, key: apiKey })

    // 鉴权
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (blueprint.auth.location === 'header' && apiKey) {
        const v = (blueprint.auth.valuePattern || '{key}').replace(/\{key\}/g, apiKey)
        headers[blueprint.auth.name || 'Authorization'] = v
    }
    if (blueprint.auth.extra) Object.assign(headers, blueprint.auth.extra)

    let finalUrl = url
    if (blueprint.auth.location === 'query' && apiKey) {
        const sep = url.includes('?') ? '&' : '?'
        finalUrl = `${url}${sep}${blueprint.auth.name || 'key'}=${encodeURIComponent(apiKey)}`
    }

    try {
        const text = await sendRequest(finalUrl, 'GET', headers, null)
        const data = JSON.parse(text)

        const models = blueprint.listModels.extractor
            ? blueprint.listModels.extractor(data)
            : (blueprint.schema ? extractModelsFromResponse(data, blueprint.schema) : [])

        if (models.length === 0) {
            return { success: false, models: [], error: '解析到 0 个模型,请检查协议配置' }
        }

        return { success: true, models }
    } catch (e) {
        return {
            success: false,
            models: [],
            error: e instanceof Error ? e.message : '请求失败'
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
            throw new Error(`HTTP ${resp.status}: ${resp.body.slice(0, 300)}`)
        }
        return resp.body
    }

    // 浏览器: 走 /api/proxy
    const resp = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, method, headers, body })
    })

    if (!resp.ok) {
        throw new Error(`代理失败: ${resp.status}`)
    }

    const data = await resp.json()
    if (!data.ok) {
        let msg = `HTTP ${data.status}`
        try {
            const j = JSON.parse(data.body)
            msg = j?.error?.message || j?.message || j?.error || msg
        } catch {
            msg = `${msg}: ${String(data.body).slice(0, 200)}`
        }
        throw new Error(msg)
    }

    return data.body
}
