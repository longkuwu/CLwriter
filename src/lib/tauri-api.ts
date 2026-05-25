/**
 * Tauri API Client - 通过 Tauri 后端代理调用 AI API
 * 
 * 解决浏览器 CORS 限制问题，支持任意 API 端点
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// 主流 AI 服务商配置
export const AI_PROVIDERS = {
    openai: {
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        defaultModel: 'gpt-4o',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    },
    deepseek: {
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        defaultModel: 'deepseek-chat',
        models: ['deepseek-chat', 'deepseek-coder'],
    },
    anthropic: {
        name: 'Anthropic (Claude)',
        baseUrl: 'https://api.anthropic.com/v1',
        defaultModel: 'claude-3-5-sonnet-20241022',
        models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
    },
    siliconflow: {
        name: 'SiliconFlow',
        baseUrl: 'https://api.siliconflow.cn/v1',
        defaultModel: 'deepseek-ai/DeepSeek-V3',
        models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct', 'THUDM/glm-4-9b-chat'],
    },
    moonshot: {
        name: 'Moonshot (月之暗面)',
        baseUrl: 'https://api.moonshot.cn/v1',
        defaultModel: 'moonshot-v1-8k',
        models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    },
    zhipu: {
        name: '智谱 AI',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        defaultModel: 'glm-4',
        models: ['glm-4', 'glm-4-flash', 'glm-3-turbo'],
    },
    ollama: {
        name: 'Ollama (本地)',
        baseUrl: 'http://localhost:11434/v1',
        defaultModel: 'llama3',
        models: ['llama3', 'mistral', 'qwen2', 'deepseek-coder-v2'],
    },
    custom: {
        name: '自定义 API',
        baseUrl: '',
        defaultModel: '',
        models: [],
    },
} as const;

export type AIProviderKey = keyof typeof AI_PROVIDERS;

// localStorage Keys
const STORAGE_KEYS = {
    PROVIDER: 'ip_architect_selected_provider',
    API_KEY: 'ip_architect_api_key',
    CUSTOM_URL: 'ip_architect_custom_api_url',
    CUSTOM_MODEL: 'ip_architect_custom_model_name',
    CUSTOM_PROTOCOL: 'ip_architect_custom_api_protocol',  // 自定义API的协议格式
};

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface ChatCompletionRequest {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
}

interface StreamCallbacks {
    onChunk: (text: string) => void;
    onDone: () => void;
    onError: (error: string) => void;
}

/**
 * 自定义 API 的协议类型
 */
export type CustomApiProtocol = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'auto'

/**
 * 获取当前 AI 配置
 */
export function getAIConfig() {
    if (typeof window === 'undefined') {
        throw new Error('只能在浏览器环境中使用');
    }

    const provider = (localStorage.getItem(STORAGE_KEYS.PROVIDER) || 'deepseek') as AIProviderKey;
    const apiKey = localStorage.getItem(STORAGE_KEYS.API_KEY) || '';
    const customUrl = localStorage.getItem(STORAGE_KEYS.CUSTOM_URL) || '';
    const customModel = localStorage.getItem(STORAGE_KEYS.CUSTOM_MODEL) || '';
    const customProtocol = (localStorage.getItem(STORAGE_KEYS.CUSTOM_PROTOCOL) || 'auto') as CustomApiProtocol;

    const providerConfig = AI_PROVIDERS[provider];
    const baseUrl = provider === 'custom' ? customUrl : providerConfig.baseUrl;
    const model = provider === 'custom' && customModel ? customModel : providerConfig.defaultModel;

    // 解析实际使用的协议
    let protocol: CustomApiProtocol
    if (provider === 'anthropic') protocol = 'anthropic'
    else if (provider === 'custom') protocol = customProtocol === 'auto' ? 'openai' : customProtocol
    else protocol = 'openai'

    return { provider, apiKey, baseUrl, model, customProtocol, protocol };
}

/**
 * 保存 AI 配置
 */
export function saveAIConfig(config: {
    provider: AIProviderKey;
    apiKey: string;
    customUrl?: string;
    customModel?: string;
    customProtocol?: CustomApiProtocol;
}) {
    localStorage.setItem(STORAGE_KEYS.PROVIDER, config.provider);
    localStorage.setItem(STORAGE_KEYS.API_KEY, config.apiKey);
    if (config.customUrl !== undefined) {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_URL, config.customUrl);
    }
    if (config.customModel !== undefined) {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_MODEL, config.customModel);
    }
    if (config.customProtocol !== undefined) {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_PROTOCOL, config.customProtocol);
    }
}

/**
 * 检测是否在 Tauri 环境中运行
 */
export function isTauriEnv(): boolean {
    return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * 通过 Tauri 代理发送 HTTP 请求
 */
async function tauriHttpProxy(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string
): Promise<{ status: number; body: string; ok: boolean }> {
    return await invoke('http_proxy', {
        request: { url, method, headers, body },
    });
}

/**
 * 构建请求头
 */
function buildHeaders(apiKey: string, protocol: CustomApiProtocol): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (protocol === 'anthropic') {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
    } else if (protocol === 'gemini') {
        // Gemini 用 ?key= 参数,header 不带 Authorization
    } else {
        // openai / ollama
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    }

    return headers;
}

/**
 * 构建请求 URL (Gemini 需要把 key 拼到 URL)
 */
function buildRequestUrl(baseUrl: string, model: string, protocol: CustomApiProtocol, apiKey: string): string {
    if (protocol === 'anthropic') {
        // Anthropic: POST /v1/messages
        return `${baseUrl}/messages`
    }
    if (protocol === 'gemini') {
        // Gemini: POST /v1beta/models/{model}:generateContent?key=...
        const root = baseUrl.includes('/v1beta') ? baseUrl : `${baseUrl}/v1beta`
        return `${root}/models/${model}:generateContent?key=${apiKey}`
    }
    // openai / ollama: POST /chat/completions
    return `${baseUrl}/chat/completions`
}

/**
 * 构建请求 body (各协议格式不同)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildRequestBody(messages: ChatMessage[], model: string, options: { temperature?: number; maxTokens?: number; stream?: boolean }, protocol: CustomApiProtocol): any {
    const stream = options.stream ?? false

    if (protocol === 'anthropic') {
        // Anthropic: { model, max_tokens, system, messages: [{role, content}] }
        const sys = messages.find(m => m.role === 'system')?.content
        const others = messages.filter(m => m.role !== 'system')
        return {
            model,
            max_tokens: options.maxTokens ?? 2048,
            temperature: options.temperature ?? 0.7,
            system: sys,
            messages: others.map(m => ({ role: m.role, content: m.content })),
            stream
        }
    }

    if (protocol === 'gemini') {
        // Gemini: { contents: [{role: 'user'|'model', parts: [{text}]}], systemInstruction, generationConfig }
        const sys = messages.find(m => m.role === 'system')?.content
        const others = messages.filter(m => m.role !== 'system')
        return {
            systemInstruction: sys ? { parts: [{ text: sys }] } : undefined,
            contents: others.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            })),
            generationConfig: {
                temperature: options.temperature ?? 0.7,
                maxOutputTokens: options.maxTokens ?? 2048
            }
        }
    }

    // openai / ollama
    return {
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
        stream
    }
}

/**
 * 提取响应内容 (各协议格式不同)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractContent(data: any, protocol: CustomApiProtocol): string {
    if (protocol === 'anthropic') {
        // { content: [{ type: 'text', text: '...' }] }
        if (Array.isArray(data?.content)) {
            return data.content.map((c: { text?: string }) => c.text || '').join('')
        }
        return ''
    }
    if (protocol === 'gemini') {
        // { candidates: [{ content: { parts: [{text}] } }] }
        return data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || ''
    }
    // openai / ollama
    return data?.choices?.[0]?.message?.content || ''
}

/**
 * 非流式对话
 *
 * 优先用协议蓝图系统(新),fallback 到旧硬编码逻辑(向后兼容)
 */
export async function chatCompletion(
    messages: ChatMessage[],
    options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
    }
): Promise<string> {
    // 优先尝试新协议蓝图
    try {
        const { getActiveBlueprint, chatCompletion: bpChat } = await import('./ai/protocol/client')
        const active = getActiveBlueprint()
        if (active && (active.apiKey || active.blueprint.auth.location === 'none')) {
            return await bpChat(messages, options)
        }
    } catch (e) {
        console.warn('[chatCompletion] 蓝图调用失败,fallback 到旧逻辑:', e instanceof Error ? e.message : e)
    }

    // === 旧逻辑 (兼容旧设置) ===
    return await legacyChatCompletion(messages, options)
}

/**
 * 旧版本硬编码 chatCompletion (兼容旧设置)
 */
async function legacyChatCompletion(
    messages: ChatMessage[],
    options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
    }
): Promise<string> {
    const config = getAIConfig();

    if (!config.apiKey && config.protocol !== 'ollama') {
        throw new Error('请先配置 API Key');
    }

    const model = options?.model || config.model;
    const url = buildRequestUrl(config.baseUrl, model, config.protocol, config.apiKey);
    const headers = buildHeaders(config.apiKey, config.protocol);
    const body = buildRequestBody(messages, model, {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        stream: false
    }, config.protocol);

    if (isTauriEnv()) {
        const response = await tauriHttpProxy(url, 'POST', headers, JSON.stringify(body));
        if (!response.ok) {
            const errorData = JSON.parse(response.body || '{}');
            throw new Error(errorData?.error?.message || errorData?.message || `API 请求失败: ${response.status}`);
        }
        const data = JSON.parse(response.body);
        return extractContent(data, config.protocol);
    } else {
        // 浏览器开发环境: 走 Next.js API 代理绕过 CORS
        const proxyResp = await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url,
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            })
        });
        if (!proxyResp.ok) {
            throw new Error(`代理失败: ${proxyResp.status}`);
        }
        const proxyData = await proxyResp.json();
        if (!proxyData.ok) {
            try {
                const err = JSON.parse(proxyData.body)
                throw new Error(err?.error?.message || err?.message || `API 请求失败: ${proxyData.status}`);
            } catch {
                throw new Error(`API 请求失败: ${proxyData.status}`);
            }
        }
        const data = JSON.parse(proxyData.body);
        return extractContent(data, config.protocol);
    }
}

/**
 * 流式对话
 *
 * 优先用协议蓝图系统(新),fallback 到旧逻辑
 */
export async function streamChatCompletion(
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
    options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
    }
): Promise<void> {
    // 优先尝试新协议蓝图
    try {
        const { getActiveBlueprint, streamChatCompletion: bpStream } = await import('./ai/protocol/client')
        const active = getActiveBlueprint()
        if (active && (active.apiKey || active.blueprint.auth.location === 'none')) {
            return await bpStream(messages, callbacks, options)
        }
    } catch (e) {
        console.warn('[streamChat] 蓝图调用失败,fallback 到旧逻辑:', e instanceof Error ? e.message : e)
    }

    // === 旧逻辑 ===
    return await legacyStreamChatCompletion(messages, callbacks, options)
}

async function legacyStreamChatCompletion(
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
    options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
    }
): Promise<void> {
    const config = getAIConfig();

    // 确保回调存在
    const safeCallbacks = {
        onChunk: callbacks?.onChunk || (() => { }),
        onDone: callbacks?.onDone || (() => { }),
        onError: callbacks?.onError || ((e: string) => console.error('Stream error (no callback):', e))
    };

    if (!config.apiKey && config.protocol !== 'ollama') {
        safeCallbacks.onError('请先配置 API Key');
        return;
    }

    const model = options?.model || config.model;
    const url = buildRequestUrl(config.baseUrl, model, config.protocol, config.apiKey);
    const headers = buildHeaders(config.apiKey, config.protocol);
    const body = buildRequestBody(messages, model, {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        stream: true
    }, config.protocol);

    // SSE chunk 解析(各协议格式不同)
    const parseChunk = (rawChunk: string) => {
        const lines = rawChunk.split('\n')
        for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]' || !data) continue
            try {
                const json = JSON.parse(data)
                let content = ''

                if (config.protocol === 'anthropic') {
                    // Anthropic: { type: 'content_block_delta', delta: { text } }
                    if (json.type === 'content_block_delta') {
                        content = json.delta?.text || ''
                    }
                } else if (config.protocol === 'gemini') {
                    // Gemini: { candidates: [{ content: { parts: [{text}] } }] }
                    content = json.candidates?.[0]?.content?.parts?.[0]?.text || ''
                } else {
                    // openai / ollama
                    content = json.choices?.[0]?.delta?.content || ''
                }

                if (content) safeCallbacks.onChunk(content)
            } catch {
                // 忽略解析错误
            }
        }
    }

    if (isTauriEnv()) {
        // 使用 Tauri 流式代理
        let unlistenChunk: UnlistenFn | null = null;
        let unlistenDone: UnlistenFn | null = null;
        let unlistenError: UnlistenFn | null = null;

        try {
            unlistenChunk = await listen<string>('stream-chunk', (event) => {
                parseChunk(event.payload);
            });

            unlistenDone = await listen('stream-done', () => {
                safeCallbacks.onDone();
            });

            unlistenError = await listen<string>('stream-error', (event) => {
                safeCallbacks.onError(event.payload);
            });

            await invoke('http_stream', {
                request: { url, method: 'POST', headers, body: JSON.stringify(body) },
            });
        } finally {
            unlistenChunk?.();
            unlistenDone?.();
            unlistenError?.();
        }
    } else {
        // 非 Tauri 环境使用 fetch streaming
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });

            if (!response.ok || !response.body) {
                const errorData = await response.json().catch(() => ({}));
                safeCallbacks.onError(errorData?.error?.message || errorData?.message || `API 请求失败: ${response.status}`);
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                parseChunk(text);
            }

            safeCallbacks.onDone();
        } catch (error) {
            safeCallbacks.onError(error instanceof Error ? error.message : '未知错误');
        }
    }
}
