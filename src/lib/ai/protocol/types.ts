/**
 * 协议蓝图 - 通用 API 协议描述
 *
 * 任何协议 = URL 模板 + 鉴权 + 请求转换 + 响应解析 + 流式解析
 *
 * 通过 JSON 配置就能接入任何 LLM API,无需改代码
 */

// ========== 鉴权方式 ==========

export type AuthLocation = 'header' | 'query' | 'body' | 'none'

export interface AuthSpec {
    location: AuthLocation        // 鉴权放在哪里
    name?: string                 // 字段名 (如 'Authorization' / 'x-api-key' / 'key')
    valuePattern?: string         // 值模板 (如 'Bearer {key}' 或 '{key}')
    extra?: Record<string, string> // 附加 headers (如 anthropic-version)
}

// ========== 路径定义 ==========

/**
 * URL 路径模板,支持变量:
 *   {baseUrl}  - 用户配置的 baseURL
 *   {model}    - 当前模型 ID
 *   {key}      - API Key
 *
 * 示例:
 *   '{baseUrl}/v1/chat/completions'
 *   '{baseUrl}/v1beta/models/{model}:generateContent?key={key}'
 *   '{baseUrl}/v1/messages'
 */
export type UrlTemplate = string

// ========== 请求体转换 ==========

/**
 * 标准化的内部消息格式
 */
export interface NormalizedMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

export interface NormalizedRequest {
    messages: NormalizedMessage[]
    model: string
    temperature: number
    maxTokens: number
    stream: boolean
}

/**
 * 请求体构建函数
 * 把标准化请求转换成该协议要求的 JSON
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RequestBuilder = (req: NormalizedRequest) => any

// ========== 响应解析 ==========

/**
 * 从响应 JSON 中提取生成的文本内容
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ResponseExtractor = (data: any) => string

/**
 * 从流式 chunk 中提取增量文本
 * 返回 null 表示这个 chunk 不包含文本 (如心跳/元数据)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StreamChunkExtractor = (json: any) => string | null

// ========== 模型扫描 ==========

export interface ListModelsSpec {
    /**
     * 模型列表端点路径 (相对于 baseUrl)
     * 不支持模型扫描时为 null
     */
    endpoint: UrlTemplate | null
    /**
     * 从响应中提取模型数组
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractor?: (data: any) => Array<{ id: string; name?: string; contextLength?: number; description?: string }>
}

// ========== 协议蓝图主结构 ==========

export interface ProtocolBlueprint {
    id: string                       // 唯一标识 (如 'openai' / 'newapi-v1' / 'custom-xxx')
    name: string                     // 显示名 (如 'NewAPI 中转')
    description?: string             // 简介
    icon?: string                    // 图标 emoji
    builtIn: boolean                 // 是否内置 (内置不可删除)

    // 默认 baseUrl (可空,用户填)
    defaultBaseUrl?: string

    // 鉴权
    auth: AuthSpec

    // 端点
    chatEndpoint: UrlTemplate        // 对话端点
    listModels?: ListModelsSpec      // 模型扫描

    // 请求/响应处理 (函数式) - 内置蓝图用代码,自定义蓝图用 JSON-Path 字符串描述
    requestBuilder?: RequestBuilder
    responseExtractor?: ResponseExtractor
    streamChunkExtractor?: StreamChunkExtractor

    // 自定义蓝图通过 JSON 配置来描述映射规则 (代替函数)
    schema?: ProtocolSchema
}

// ========== JSON 配置版协议 (无需写代码) ==========

/**
 * 字段映射: 把内部字段映射到协议字段
 *
 * 示例:
 *   { "model": "model", "messages": "messages", "temperature": "options.temperature" }
 *   表示把内部 req.temperature 写到 body.options.temperature
 */
export interface FieldMap {
    model?: string                   // 模型字段名 (默认 'model')
    messages?: string                // 消息字段名 (默认 'messages')
    temperature?: string             // 温度字段名 (默认 'temperature')
    maxTokens?: string               // 最大 token 字段名 (默认 'max_tokens')
    stream?: string                  // 流式字段名 (默认 'stream')
    system?: string                  // system 提示词的独立字段 (如 anthropic 的 'system')
}

export interface ProtocolSchema {
    /**
     * 消息格式
     * 'openai': [{role: 'user', content: '...'}]
     * 'anthropic': [{role: 'user', content: '...'}] (system 单独提取)
     * 'gemini': [{role: 'user', parts: [{text: '...'}]}] (用 contents 字段)
     * 'flat': 把 messages 拼成单个 prompt 字符串 (旧式 completion)
     */
    messageFormat: 'openai' | 'anthropic' | 'gemini' | 'flat'

    /**
     * 字段映射 (输入)
     */
    fieldMap?: FieldMap

    /**
     * 静态附加字段 (会原样合并到 body)
     */
    extraBody?: Record<string, unknown>

    /**
     * 响应文本路径 (用 dot-path)
     * 'choices.0.message.content' (openai)
     * 'content.0.text' (anthropic)
     * 'candidates.0.content.parts.0.text' (gemini)
     */
    responsePath: string

    /**
     * 流式 chunk 文本路径
     */
    streamChunkPath?: string

    /**
     * 流式标记: 用什么标识结束
     * 默认 'data: [DONE]'
     */
    streamDoneMarker?: string

    /**
     * Anthropic 流式特殊: 仅当 type === 'content_block_delta' 才提取
     */
    streamConditionField?: string
    streamConditionValue?: string

    /**
     * 模型列表响应路径
     * 'data' (openai)
     * 'models' (gemini/ollama)
     */
    modelListPath?: string

    /**
     * 模型列表项的 ID 字段
     */
    modelIdField?: string            // 'id' / 'name'

    /**
     * 是否需要把 'models/' 前缀剥掉 (Gemini)
     */
    stripModelPrefix?: boolean
}
