/**
 * 模型扫描器 - 自动探测自定义 API 端点支持的模型列表
 *
 * 支持的协议格式:
 *   1. OpenAI Compatible: GET /v1/models  →  { data: [{ id, ... }] }
 *      (覆盖 OpenAI / DeepSeek / SiliconFlow / Moonshot / OpenRouter / Together / Groq / Ollama / 智谱 / 千问等)
 *
 *   2. Anthropic Native: GET /v1/models (with x-api-key header)
 *      →  { data: [{ id, type: 'model', ... }] }
 *
 *   3. Google Gemini: GET /v1beta/models?key=API_KEY
 *      →  { models: [{ name: 'models/gemini-1.5-pro', ... }] }
 *
 *   4. Ollama: GET /api/tags  →  { models: [{ name, ... }] }
 *
 * 扫描策略:
 *   - 自动探测协议: 智能识别 URL 是否包含 /v1 / /v1beta / /api 等路径
 *   - 多端点尝试: 从最可能的端点开始,失败则降级
 *   - 超时保护: 单个请求最多 8 秒
 */

import { isTauriEnv } from '../tauri-api'
import { invoke } from '@tauri-apps/api/core'

export type ApiProtocol =
    | 'openai'        // OpenAI 兼容格式
    | 'anthropic'     // Anthropic 原生格式
    | 'gemini'        // Google Gemini 格式
    | 'ollama'        // Ollama 本地格式
    | 'unknown'

export interface ScannedModel {
    id: string
    name: string              // 显示名 (一般等于 id)
    contextLength?: number    // 上下文长度 (若可获取)
    description?: string
    capabilities?: string[]   // 能力标签 (chat/embedding/vision...)
}

export interface ScanResult {
    success: boolean
    protocol: ApiProtocol
    baseUrl: string           // 规范化后的 baseURL
    models: ScannedModel[]
    error?: string
    triedEndpoints: string[]  // 尝试过的端点 (用于调试)
}

// ========== 入口函数 ==========

/**
 * 扫描自定义 API 端点的可用模型
 *
 * @param rawUrl 用户输入的 URL,可能形态:
 *   - https://api.openai.com         → 自动加 /v1
 *   - https://api.openai.com/v1      → 直接用
 *   - https://api.openai.com/v1/chat → 自动剥到 /v1
 *   - http://localhost:11434         → Ollama
 *   - https://generativelanguage.googleapis.com → Gemini
 * @param apiKey API Key (可空,部分端点不需要)
 */
export async function scanModels(
    rawUrl: string,
    apiKey: string = ''
): Promise<ScanResult> {
    const baseUrl = normalizeBaseUrl(rawUrl)
    const triedEndpoints: string[] = []

    // 1. 优先尝试: Ollama 特征 (端口 11434)
    if (isOllama(baseUrl)) {
        const r = await tryOllama(baseUrl)
        triedEndpoints.push(...r.triedEndpoints)
        if (r.success) return { ...r, triedEndpoints }
    }

    // 2. 优先尝试: Gemini 特征
    if (isGemini(baseUrl)) {
        const r = await tryGemini(baseUrl, apiKey)
        triedEndpoints.push(...r.triedEndpoints)
        if (r.success) return { ...r, triedEndpoints }
    }

    // 3. 优先尝试: Anthropic 特征
    if (isAnthropic(baseUrl)) {
        const r = await tryAnthropic(baseUrl, apiKey)
        triedEndpoints.push(...r.triedEndpoints)
        if (r.success) return { ...r, triedEndpoints }
    }

    // 4. 默认尝试: OpenAI 兼容格式 (覆盖 80% 服务商)
    const openai = await tryOpenAI(baseUrl, apiKey)
    triedEndpoints.push(...openai.triedEndpoints)
    if (openai.success) return { ...openai, triedEndpoints }

    // 5. 兜底: 再试一次 Ollama / Gemini (用户可能输入了不带 hint 的 URL)
    if (!isOllama(baseUrl)) {
        const r = await tryOllama(baseUrl)
        triedEndpoints.push(...r.triedEndpoints)
        if (r.success) return { ...r, triedEndpoints }
    }

    if (!isGemini(baseUrl) && apiKey) {
        const r = await tryGemini(baseUrl, apiKey)
        triedEndpoints.push(...r.triedEndpoints)
        if (r.success) return { ...r, triedEndpoints }
    }

    return {
        success: false,
        protocol: 'unknown',
        baseUrl,
        models: [],
        error: openai.error || '所有协议探测均失败,请检查 URL 与 API Key',
        triedEndpoints
    }
}

// ========== URL 规范化 ==========

/**
 * 把用户输入的 URL 规范化为 baseURL
 *
 * 规则:
 *   - 去除尾部斜杠
 *   - 去除常见尾部路径: /chat/completions, /completions, /messages
 */
export function normalizeBaseUrl(rawUrl: string): string {
    let url = rawUrl.trim().replace(/\/+$/, '')

    // 移除常见尾部 (用户可能复制了完整 endpoint)
    const TRAILS = [
        '/chat/completions',
        '/completions',
        '/messages',
        '/embeddings',
        '/models'
    ]
    for (const t of TRAILS) {
        if (url.toLowerCase().endsWith(t)) {
            url = url.slice(0, -t.length)
        }
    }

    return url
}

// ========== 特征识别 ==========

function isOllama(url: string): boolean {
    return url.includes(':11434') || url.includes('ollama')
}

function isGemini(url: string): boolean {
    return url.includes('generativelanguage.googleapis.com') || url.includes('/v1beta')
}

function isAnthropic(url: string): boolean {
    return url.includes('api.anthropic.com') || url.includes('/v1/messages')
}

// ========== 协议探测器 ==========

interface TryResult {
    success: boolean
    protocol: ApiProtocol
    baseUrl: string
    models: ScannedModel[]
    error?: string
    triedEndpoints: string[]
}

/**
 * OpenAI 兼容格式
 */
async function tryOpenAI(baseUrl: string, apiKey: string): Promise<TryResult> {
    const tried: string[] = []
    // 候选 endpoints (按可能性排序)
    const candidates = inferOpenAIEndpoints(baseUrl)

    for (const ep of candidates) {
        tried.push(ep)
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' }
            if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

            const data = await fetchJson(ep, headers)
            if (!data) continue

            // 解析 OpenAI 格式: { data: [{ id, ... }] }
            // 也兼容 { models: [...] } 和 [...]
            const list = extractModelList(data)
            if (list.length > 0) {
                return {
                    success: true,
                    protocol: 'openai',
                    baseUrl: ep.replace(/\/models$/, ''),
                    models: list,
                    triedEndpoints: tried
                }
            }
        } catch (e) {
            console.warn(`[ModelScanner] ${ep} 失败:`, e instanceof Error ? e.message : e)
        }
    }

    return {
        success: false,
        protocol: 'openai',
        baseUrl,
        models: [],
        error: '所有 OpenAI 兼容端点均失败',
        triedEndpoints: tried
    }
}

/**
 * 从 baseUrl 推断 OpenAI 兼容的 /models 端点候选列表
 */
function inferOpenAIEndpoints(baseUrl: string): string[] {
    const out: string[] = []

    // 已经包含 /v1 等
    if (baseUrl.match(/\/v\d+(?:beta\d*)?$/)) {
        out.push(`${baseUrl}/models`)
        return out
    }

    // 已经包含但不在末尾 (如 https://x/v1/openai)
    const v1Match = baseUrl.match(/(.*\/v\d+(?:beta\d*)?)/)
    if (v1Match) {
        out.push(`${baseUrl}/models`)
        out.push(`${v1Match[1]}/models`)
        return out
    }

    // 未指定版本,尝试常见路径
    out.push(`${baseUrl}/v1/models`)
    out.push(`${baseUrl}/api/v1/models`)
    out.push(`${baseUrl}/openai/v1/models`)
    out.push(`${baseUrl}/models`)
    return Array.from(new Set(out))
}

/**
 * Anthropic 原生格式
 */
async function tryAnthropic(baseUrl: string, apiKey: string): Promise<TryResult> {
    const tried: string[] = []
    const endpoints = baseUrl.match(/\/v\d+/) ? [`${baseUrl}/models`] : [`${baseUrl}/v1/models`]

    for (const ep of endpoints) {
        tried.push(ep)
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            }
            if (apiKey) headers['x-api-key'] = apiKey

            const data = await fetchJson(ep, headers)
            if (!data) continue

            const list = extractModelList(data)
            if (list.length > 0) {
                return {
                    success: true,
                    protocol: 'anthropic',
                    baseUrl: ep.replace(/\/models$/, ''),
                    models: list,
                    triedEndpoints: tried
                }
            }
        } catch {
            // 继续
        }
    }

    return {
        success: false,
        protocol: 'anthropic',
        baseUrl,
        models: [],
        error: 'Anthropic 端点失败',
        triedEndpoints: tried
    }
}

/**
 * Google Gemini 格式
 */
async function tryGemini(baseUrl: string, apiKey: string): Promise<TryResult> {
    const tried: string[] = []
    const root = baseUrl.includes('/v1beta') ? baseUrl : `${baseUrl}/v1beta`
    const endpoints = [
        apiKey ? `${root}/models?key=${apiKey}` : `${root}/models`
    ]

    for (const ep of endpoints) {
        tried.push(ep.replace(/key=[^&]+/, 'key=***'))
        try {
            const data = await fetchJson(ep, { 'Content-Type': 'application/json' })
            if (!data) continue

            // Gemini 格式: { models: [{ name: 'models/gemini-1.5-pro', displayName, ... }] }
            const arr = (data as { models?: Array<{ name?: string; displayName?: string; description?: string; inputTokenLimit?: number; supportedGenerationMethods?: string[] }> }).models
            if (Array.isArray(arr) && arr.length > 0) {
                const list: ScannedModel[] = arr
                    .filter(m => m.name && m.supportedGenerationMethods?.includes('generateContent'))
                    .map(m => ({
                        id: (m.name || '').replace(/^models\//, ''),
                        name: m.displayName || (m.name || '').replace(/^models\//, ''),
                        contextLength: m.inputTokenLimit,
                        description: m.description,
                        capabilities: m.supportedGenerationMethods
                    }))
                if (list.length > 0) {
                    return {
                        success: true,
                        protocol: 'gemini',
                        baseUrl: root,
                        models: list,
                        triedEndpoints: tried
                    }
                }
            }
        } catch {
            // 继续
        }
    }

    return {
        success: false,
        protocol: 'gemini',
        baseUrl,
        models: [],
        error: 'Gemini 端点失败',
        triedEndpoints: tried
    }
}

/**
 * Ollama 本地格式
 */
async function tryOllama(baseUrl: string): Promise<TryResult> {
    const tried: string[] = []
    const endpoints = [
        `${baseUrl}/api/tags`,
        `${baseUrl}/v1/models`     // Ollama 也支持 OpenAI 兼容
    ]

    for (const ep of endpoints) {
        tried.push(ep)
        try {
            const data = await fetchJson(ep, { 'Content-Type': 'application/json' })
            if (!data) continue

            // Ollama /api/tags 格式: { models: [{ name: 'llama3:latest', size, ... }] }
            const arr = (data as { models?: Array<{ name?: string; size?: number; details?: { parameter_size?: string } }> }).models
            if (Array.isArray(arr) && arr.length > 0 && ep.includes('/api/tags')) {
                const list: ScannedModel[] = arr.map(m => ({
                    id: m.name || '',
                    name: m.name || '',
                    description: m.details?.parameter_size ? `${m.details.parameter_size} 参数` : undefined
                })).filter(m => m.id)
                if (list.length > 0) {
                    return {
                        success: true,
                        protocol: 'ollama',
                        baseUrl: `${baseUrl}/v1`,  // 写入应用的 baseUrl 用 OpenAI 兼容路径
                        models: list,
                        triedEndpoints: tried
                    }
                }
            }

            // /v1/models 走 OpenAI 解析
            const list = extractModelList(data)
            if (list.length > 0) {
                return {
                    success: true,
                    protocol: 'ollama',
                    baseUrl: ep.replace(/\/models$/, ''),
                    models: list,
                    triedEndpoints: tried
                }
            }
        } catch {
            // 继续
        }
    }

    return {
        success: false,
        protocol: 'ollama',
        baseUrl,
        models: [],
        error: 'Ollama 端点失败',
        triedEndpoints: tried
    }
}

// ========== 通用模型列表提取 ==========

/**
 * 从响应中提取模型列表
 * 支持的格式:
 *   - { data: [...] }     (OpenAI / Anthropic)
 *   - { models: [...] }   (Gemini / Ollama)
 *   - [...]               (扁平数组)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractModelList(data: any): ScannedModel[] {
    let arr: unknown[] = []

    if (Array.isArray(data)) {
        arr = data
    } else if (data && typeof data === 'object') {
        if (Array.isArray(data.data)) arr = data.data
        else if (Array.isArray(data.models)) arr = data.models
        else if (Array.isArray(data.result)) arr = data.result
    }

    return arr
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((m: any): ScannedModel | null => {
            if (typeof m === 'string') return { id: m, name: m }
            if (!m || typeof m !== 'object') return null

            const id = m.id || m.model || m.name || ''
            if (!id) return null

            return {
                id: typeof id === 'string' ? id.replace(/^models\//, '') : String(id),
                name: m.display_name || m.displayName || m.name || id,
                contextLength: m.context_length || m.contextLength || m.inputTokenLimit,
                description: m.description,
                capabilities: m.capabilities || m.supportedGenerationMethods
            }
        })
        .filter((m): m is ScannedModel => m !== null)
}

// ========== HTTP 工具 ==========

const FETCH_TIMEOUT_MS = 8000

/**
 * 拉取 JSON,支持 Tauri 代理 + 浏览器 fetch + Next.js API 代理
 */
async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown> {
    if (isTauriEnv()) {
        // Tauri 代理 (绕过 CORS)
        const response = await invoke<{ status: number; body: string; ok: boolean }>('http_proxy', {
            request: { url, method: 'GET', headers, body: null }
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.body.slice(0, 200)}`)
        return JSON.parse(response.body)
    }

    // 浏览器环境: 走 Next.js API 代理 (绕过 CORS)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    try {
        const r = await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, method: 'GET', headers, body: null }),
            signal: ctrl.signal
        })
        if (!r.ok) throw new Error(`Proxy error: ${r.status}`)
        const data = await r.json()
        if (!data.ok) {
            throw new Error(`HTTP ${data.status}: ${String(data.body).slice(0, 200)}`)
        }
        return JSON.parse(data.body)
    } finally {
        clearTimeout(timer)
    }
}
