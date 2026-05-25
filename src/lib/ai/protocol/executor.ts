/**
 * 协议蓝图执行器
 *
 * 把 ProtocolBlueprint 翻译成实际的 HTTP 请求/响应处理逻辑
 */

import type {
    ProtocolBlueprint,
    NormalizedRequest,
    NormalizedMessage,
    AuthSpec,
    ProtocolSchema
} from './types'

// ========== URL 模板渲染 ==========

export function renderUrl(
    template: string,
    vars: { baseUrl: string; model?: string; key?: string }
): string {
    return template
        .replace(/\{baseUrl\}/g, vars.baseUrl.replace(/\/+$/, ''))
        .replace(/\{model\}/g, vars.model || '')
        .replace(/\{key\}/g, vars.key || '')
}

// ========== 鉴权应用 ==========

export interface AppliedAuth {
    headers: Record<string, string>
    queryParams: Record<string, string>
    bodyOverrides: Record<string, unknown>
}

export function applyAuth(spec: AuthSpec, apiKey: string): AppliedAuth {
    const result: AppliedAuth = { headers: {}, queryParams: {}, bodyOverrides: {} }

    // 附加 headers (anthropic-version 等)
    if (spec.extra) {
        for (const [k, v] of Object.entries(spec.extra)) {
            result.headers[k] = v
        }
    }

    if (spec.location === 'none' || !apiKey) return result

    const value = (spec.valuePattern || '{key}').replace(/\{key\}/g, apiKey)
    const name = spec.name || (spec.location === 'header' ? 'Authorization' : 'key')

    if (spec.location === 'header') result.headers[name] = value
    else if (spec.location === 'query') result.queryParams[name] = value
    else if (spec.location === 'body') result.bodyOverrides[name] = value

    return result
}

// ========== 请求体构建 ==========

/**
 * 用 JSON Schema 配置构建请求体
 */
export function buildRequestFromSchema(
    req: NormalizedRequest,
    schema: ProtocolSchema
): Record<string, unknown> {
    const fm = schema.fieldMap || {}
    const body: Record<string, unknown> = {}

    // model
    setByPath(body, fm.model || 'model', req.model)

    // 消息格式转换
    let messages: unknown
    let systemContent: string | undefined

    switch (schema.messageFormat) {
        case 'anthropic': {
            // system 单独提取
            const sys = req.messages.find(m => m.role === 'system')
            systemContent = sys?.content
            const others = req.messages.filter(m => m.role !== 'system')
            messages = others.map(m => ({ role: m.role, content: m.content }))
            if (systemContent) setByPath(body, fm.system || 'system', systemContent)
            break
        }
        case 'gemini': {
            // contents: [{role: 'user'|'model', parts: [{text}]}]
            const sys = req.messages.find(m => m.role === 'system')
            systemContent = sys?.content
            const others = req.messages.filter(m => m.role !== 'system')
            messages = others.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }))
            if (systemContent) {
                body.systemInstruction = { parts: [{ text: systemContent }] }
            }
            // gemini 把 messages 字段写成 contents
            setByPath(body, fm.messages || 'contents', messages)

            // gemini 把温度等放在 generationConfig
            const gc: Record<string, unknown> = {}
            gc.temperature = req.temperature
            gc.maxOutputTokens = req.maxTokens
            body.generationConfig = gc

            // 应用 extraBody 后返回
            if (schema.extraBody) Object.assign(body, schema.extraBody)
            return body
        }
        case 'flat': {
            // 把所有消息拼成单个 prompt
            messages = req.messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')
            break
        }
        default: {
            // openai
            messages = req.messages
        }
    }

    setByPath(body, fm.messages || 'messages', messages)
    setByPath(body, fm.temperature || 'temperature', req.temperature)
    setByPath(body, fm.maxTokens || 'max_tokens', req.maxTokens)
    setByPath(body, fm.stream || 'stream', req.stream)

    // 附加静态字段
    if (schema.extraBody) {
        Object.assign(body, schema.extraBody)
    }

    return body
}

/**
 * 通用响应内容提取 (JSON-Path)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractByPath(data: any, path: string): string {
    const v = getByPath(data, path)

    // 如果是数组 (如 anthropic content: [{type, text}]),拼接
    if (Array.isArray(v)) {
        return v.map(x => {
            if (typeof x === 'string') return x
            if (x && typeof x === 'object' && 'text' in x) return String((x as { text?: string }).text || '')
            return ''
        }).join('')
    }

    return v == null ? '' : String(v)
}

/**
 * 流式 chunk 提取
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractStreamChunk(json: any, schema: ProtocolSchema): string | null {
    const path = schema.streamChunkPath
    if (!path) return null

    // 条件检查 (anthropic 仅 content_block_delta 才提取)
    if (schema.streamConditionField && schema.streamConditionValue) {
        const v = getByPath(json, schema.streamConditionField)
        if (String(v) !== schema.streamConditionValue) return null
    }

    return extractByPath(json, path) || null
}

// ========== JSON Path 工具 ==========

/**
 * 按 dot-path 取值 (支持数组下标)
 *   'choices.0.message.content'
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getByPath(obj: any, path: string): any {
    if (!obj) return undefined
    const segs = path.split('.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cur: any = obj
    for (const s of segs) {
        if (cur == null) return undefined
        if (Array.isArray(cur)) {
            const idx = parseInt(s, 10)
            if (Number.isNaN(idx)) return undefined
            cur = cur[idx]
        } else {
            cur = cur[s]
        }
    }
    return cur
}

/**
 * 按 dot-path 写值
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setByPath(obj: Record<string, any>, path: string, value: any) {
    const segs = path.split('.')
    let cur = obj
    for (let i = 0; i < segs.length - 1; i++) {
        const s = segs[i]
        if (typeof cur[s] !== 'object' || cur[s] === null) cur[s] = {}
        cur = cur[s]
    }
    cur[segs[segs.length - 1]] = value
}

// ========== 模型列表提取 ==========

/**
 * 用 schema 提取模型列表
 */
export function extractModelsFromResponse(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    schema: ProtocolSchema
): Array<{ id: string; name: string; contextLength?: number; description?: string }> {
    const path = schema.modelListPath || 'data'
    const arr = getByPath(data, path)
    if (!Array.isArray(arr)) return []

    const idField = schema.modelIdField || 'id'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return arr.map((m: any) => {
        if (typeof m === 'string') return { id: m, name: m }
        if (!m || typeof m !== 'object') return null

        let id = m[idField] || m.id || m.name || m.model || ''
        if (typeof id !== 'string') id = String(id)
        if (schema.stripModelPrefix) {
            id = id.replace(/^models\//, '')
        }
        if (!id) return null

        return {
            id,
            name: m.display_name || m.displayName || m.name || id,
            contextLength: m.context_length || m.contextLength || m.inputTokenLimit,
            description: m.description
        }
    }).filter((x): x is { id: string; name: string; contextLength?: number; description?: string } => x !== null)
}

// ========== 应用蓝图执行请求 ==========

export interface BlueprintExecutionContext {
    blueprint: ProtocolBlueprint
    baseUrl: string
    apiKey: string
}

export interface PreparedRequest {
    url: string
    headers: Record<string, string>
    body: string
}

/**
 * 用蓝图准备一个 HTTP 请求
 */
export function prepareRequest(
    ctx: BlueprintExecutionContext,
    req: NormalizedRequest
): PreparedRequest {
    const { blueprint, baseUrl, apiKey } = ctx

    // 1. URL
    let url = renderUrl(blueprint.chatEndpoint, { baseUrl, model: req.model, key: apiKey })

    // 2. 鉴权
    const auth = applyAuth(blueprint.auth, apiKey)

    // 3. 处理 query params
    if (Object.keys(auth.queryParams).length > 0) {
        const qs = new URLSearchParams(auth.queryParams).toString()
        url += (url.includes('?') ? '&' : '?') + qs
    }

    // 4. 请求体
    let bodyObj: Record<string, unknown>
    if (blueprint.requestBuilder) {
        bodyObj = blueprint.requestBuilder(req) as Record<string, unknown>
    } else if (blueprint.schema) {
        bodyObj = buildRequestFromSchema(req, blueprint.schema)
    } else {
        // 兜底 OpenAI 格式
        bodyObj = {
            model: req.model,
            messages: req.messages,
            temperature: req.temperature,
            max_tokens: req.maxTokens,
            stream: req.stream
        }
    }

    // 应用 body 鉴权
    Object.assign(bodyObj, auth.bodyOverrides)

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...auth.headers
    }

    return { url, headers, body: JSON.stringify(bodyObj) }
}

/**
 * 提取响应内容
 */
export function extractResponse(
    blueprint: ProtocolBlueprint,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any
): string {
    if (blueprint.responseExtractor) return blueprint.responseExtractor(data)
    if (blueprint.schema) return extractByPath(data, blueprint.schema.responsePath)
    return data?.choices?.[0]?.message?.content || ''
}

/**
 * 提取流式 chunk
 */
export function extractChunk(
    blueprint: ProtocolBlueprint,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json: any
): string | null {
    if (blueprint.streamChunkExtractor) return blueprint.streamChunkExtractor(json)
    if (blueprint.schema) return extractStreamChunk(json, blueprint.schema)
    return json?.choices?.[0]?.delta?.content || null
}

/**
 * 标准化消息列表
 */
export function normalizeMessages(messages: NormalizedMessage[]): NormalizedMessage[] {
    return messages.map(m => ({ role: m.role, content: m.content }))
}
