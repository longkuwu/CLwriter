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

    const providerConfig = AI_PROVIDERS[provider];
    const baseUrl = provider === 'custom' ? customUrl : providerConfig.baseUrl;
    const model = provider === 'custom' && customModel ? customModel : providerConfig.defaultModel;

    return { provider, apiKey, baseUrl, model };
}

/**
 * 保存 AI 配置
 */
export function saveAIConfig(config: {
    provider: AIProviderKey;
    apiKey: string;
    customUrl?: string;
    customModel?: string;
}) {
    localStorage.setItem(STORAGE_KEYS.PROVIDER, config.provider);
    localStorage.setItem(STORAGE_KEYS.API_KEY, config.apiKey);
    if (config.customUrl) {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_URL, config.customUrl);
    }
    if (config.customModel) {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_MODEL, config.customModel);
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
function buildHeaders(apiKey: string, provider: AIProviderKey): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (provider === 'anthropic') {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
    } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    return headers;
}

/**
 * 非流式对话
 */
export async function chatCompletion(
    messages: ChatMessage[],
    options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
    }
): Promise<string> {
    const config = getAIConfig();

    if (!config.apiKey) {
        throw new Error('请先配置 API Key');
    }

    const url = `${config.baseUrl}/chat/completions`;
    const headers = buildHeaders(config.apiKey, config.provider);

    const body: ChatCompletionRequest = {
        model: options?.model || config.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
        stream: false,
    };

    if (isTauriEnv()) {
        // 使用 Tauri 代理
        const response = await tauriHttpProxy(url, 'POST', headers, JSON.stringify(body));

        if (!response.ok) {
            const errorData = JSON.parse(response.body || '{}');
            throw new Error(errorData?.error?.message || `API 请求失败: ${response.status}`);
        }

        const data = JSON.parse(response.body);
        return data.choices?.[0]?.message?.content || '';
    } else {
        // 直接 fetch (开发时可能会有 CORS 问题)
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData?.error?.message || `API 请求失败: ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }
}

/**
 * 流式对话 (使用 Tauri 事件)
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
    const config = getAIConfig();

    // 确保回调存在
    const safeCallbacks = {
        onChunk: callbacks?.onChunk || (() => { }),
        onDone: callbacks?.onDone || (() => { }),
        onError: callbacks?.onError || ((e: string) => console.error('Stream error (no callback):', e))
    };

    if (!config.apiKey) {
        safeCallbacks.onError('请先配置 API Key');
        return;
    }

    const url = `${config.baseUrl}/chat/completions`;
    const headers = buildHeaders(config.apiKey, config.provider);

    const body: ChatCompletionRequest = {
        model: options?.model || config.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
        stream: true,
    };

    if (isTauriEnv()) {
        // 使用 Tauri 流式代理
        let unlistenChunk: UnlistenFn | null = null;
        let unlistenDone: UnlistenFn | null = null;
        let unlistenError: UnlistenFn | null = null;

        try {
            // 监听流式事件
            unlistenChunk = await listen<string>('stream-chunk', (event) => {
                // 解析 SSE 数据
                const lines = event.payload.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;
                        try {
                            const json = JSON.parse(data);
                            const content = json.choices?.[0]?.delta?.content;
                            if (content) {
                                safeCallbacks.onChunk(content);
                            }
                        } catch {
                            // 忽略解析错误
                        }
                    }
                }
            });

            unlistenDone = await listen('stream-done', () => {
                safeCallbacks.onDone();
            });

            unlistenError = await listen<string>('stream-error', (event) => {
                safeCallbacks.onError(event.payload);
            });

            // 发起流式请求
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
                safeCallbacks.onError(errorData?.error?.message || `API 请求失败: ${response.status}`);
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                const lines = text.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;
                        try {
                            const json = JSON.parse(data);
                            const content = json.choices?.[0]?.delta?.content;
                            if (content) {
                                safeCallbacks.onChunk(content);
                            }
                        } catch {
                            // 忽略解析错误
                        }
                    }
                }
            }

            safeCallbacks.onDone();
        } catch (error) {
            safeCallbacks.onError(error instanceof Error ? error.message : '未知错误');
        }
    }
}
