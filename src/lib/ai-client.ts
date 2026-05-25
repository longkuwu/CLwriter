/**
 * AI Client Library - 客户端直接调用 AI API
 * 
 * 重要说明：
 * 这个模块设计为在客户端浏览器中直接调用 AI 服务商 API。
 * 用户的 API Key 仅存储在本地 localStorage 中，
 * 请求直接从用户浏览器发送到 AI 服务商，不经过任何中转服务器。
 */

import { generateText as aiGenerateText, streamText as aiStreamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

// localStorage 存储的 key 名称
const STORAGE_KEYS = {
    DEEPSEEK_API_KEY: 'ip_architect_deepseek_api_key',
    OPENAI_API_KEY: 'ip_architect_openai_api_key',
    CUSTOM_API_KEY: 'ip_architect_custom_api_key',
    CUSTOM_API_URL: 'ip_architect_custom_api_url',
    CUSTOM_MODEL_NAME: 'ip_architect_custom_model_name',
    SELECTED_PROVIDER: 'ip_architect_selected_provider',
}

type AIProvider = 'deepseek' | 'openai' | 'custom'

interface AISettings {
    provider: AIProvider
    apiKey: string
    baseUrl?: string
    modelName?: string
}

/**
 * 从 localStorage 读取用户设置的 AI 配置
 * @throws Error 如果没有配置 API Key
 */
export function getAISettings(): AISettings {
    if (typeof window === 'undefined') {
        throw new Error('AI 客户端只能在浏览器环境中使用')
    }

    const provider = (localStorage.getItem(STORAGE_KEYS.SELECTED_PROVIDER) as AIProvider) || 'deepseek'

    let apiKey = ''
    let baseUrl: string | undefined
    let modelName: string | undefined

    if (provider === 'deepseek') {
        apiKey = localStorage.getItem(STORAGE_KEYS.DEEPSEEK_API_KEY) || ''
    } else if (provider === 'openai') {
        apiKey = localStorage.getItem(STORAGE_KEYS.OPENAI_API_KEY) || ''
    } else if (provider === 'custom') {
        apiKey = localStorage.getItem(STORAGE_KEYS.CUSTOM_API_KEY) || ''
        baseUrl = localStorage.getItem(STORAGE_KEYS.CUSTOM_API_URL) || ''
        modelName = localStorage.getItem(STORAGE_KEYS.CUSTOM_MODEL_NAME) || ''
    }

    if (!apiKey) {
        const providerName = provider === 'deepseek' ? 'DeepSeek'
            : provider === 'openai' ? 'OpenAI'
                : '自定义 API'
        throw new Error(
            `请先配置 ${providerName} API Key。` +
            '点击编辑器工具栏的设置图标进行配置。'
        )
    }

    if (provider === 'custom' && !baseUrl) {
        throw new Error('使用自定义 API 时必须配置 API Base URL。')
    }

    return { provider, apiKey, baseUrl, modelName }
}

/**
 * 创建 AI 客户端实例
 * 注意：这是直接从客户端浏览器调用 AI API，不经过服务器
 */
function createAIClient(settings: AISettings) {
    if (settings.provider === 'deepseek') {
        // DeepSeek 使用 OpenAI 兼容接口
        return createOpenAI({
            apiKey: settings.apiKey,
            baseURL: 'https://api.deepseek.com',
        })
    } else if (settings.provider === 'custom') {
        // 自定义 API (兼容 OpenAI 格式)
        return createOpenAI({
            apiKey: settings.apiKey,
            baseURL: settings.baseUrl,
        })
    } else {
        // OpenAI 原生接口
        return createOpenAI({
            apiKey: settings.apiKey,
        })
    }
}

/**
 * 获取默认模型名称
 */
function getDefaultModel(settings: AISettings): string {
    if (settings.provider === 'deepseek') {
        return 'deepseek-chat'
    } else if (settings.provider === 'custom' && settings.modelName) {
        return settings.modelName
    } else if (settings.provider === 'custom') {
        return 'gpt-4o' // fallback for custom without model name
    } else {
        return 'gpt-4o'
    }
}

export interface GenerateTextOptions {
    prompt: string
    system?: string
    model?: string
    maxTokens?: number
    temperature?: number
}

/**
 * 客户端直接调用 AI 生成文本
 * 
 * 重要：这个函数是在客户端浏览器中直接发起请求到 AI 服务商，
 * 不经过任何 Next.js 服务端 API 路由或第三方中转服务器。
 * 
 * @example
 * ```tsx
 * const result = await generateText({
 *   prompt: '帮我续写这段故事...',
 *   system: '你是一个专业的小说作家',
 * })
 * console.log(result.text)
 * ```
 */
export async function generateText(options: GenerateTextOptions): Promise<{ text: string }> {
    const settings = getAISettings()
    const client = createAIClient(settings)
    const model = options.model || getDefaultModel(settings)

    const result = await aiGenerateText({
        model: client(model),
        prompt: options.prompt,
        system: options.system,
        temperature: options.temperature ?? 0.7,
    })

    return { text: result.text }
}

export interface StreamTextOptions extends GenerateTextOptions {
    onText?: (text: string) => void
}

/**
 * 客户端直接调用 AI 流式生成文本
 * 
 * @example
 * ```tsx
 * const stream = await streamText({
 *   prompt: '帮我续写这段故事...',
 *   onText: (text) => console.log(text),
 * })
 * ```
 */
export async function streamText(options: StreamTextOptions) {
    const settings = getAISettings()
    const client = createAIClient(settings)
    const model = options.model || getDefaultModel(settings)

    const result = await aiStreamText({
        model: client(model),
        prompt: options.prompt,
        system: options.system,
        temperature: options.temperature ?? 0.7,
    })

    // 处理流式响应
    let fullText = ''
    for await (const chunk of result.textStream) {
        fullText += chunk
        options.onText?.(chunk)
    }

    return { text: fullText }
}

/**
 * 检查用户是否已配置 AI API Key
 */
export function hasAIConfigured(): boolean {
    if (typeof window === 'undefined') return false

    try {
        getAISettings()
        return true
    } catch {
        return false
    }
}
