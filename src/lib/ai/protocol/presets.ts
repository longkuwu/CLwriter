/**
 * 内置协议蓝图预设
 *
 * 包含主流 LLM 服务商的协议格式,用户也可以基于这些做改动
 */

import type { ProtocolBlueprint } from './types'

// ========== OpenAI 兼容 ==========

export const PRESET_OPENAI: ProtocolBlueprint = {
    id: 'openai',
    name: 'OpenAI 兼容',
    description: '覆盖 OpenAI / DeepSeek / Moonshot / Groq / Together / OpenRouter / 智谱 / 千问 等',
    icon: '🤖',
    builtIn: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
    auth: {
        location: 'header',
        name: 'Authorization',
        valuePattern: 'Bearer {key}'
    },
    chatEndpoint: '{baseUrl}/chat/completions',
    listModels: {
        endpoint: '{baseUrl}/models'
    },
    schema: {
        messageFormat: 'openai',
        responsePath: 'choices.0.message.content',
        streamChunkPath: 'choices.0.delta.content',
        modelListPath: 'data',
        modelIdField: 'id'
    }
}

// ========== NewAPI 中转协议 ==========

/**
 * NewAPI / OneAPI 是开源的 LLM API 中转服务
 * 它对外暴露的是 OpenAI 兼容协议,只是 baseURL 不同
 * 一般部署在 https://your-domain/v1
 */
export const PRESET_NEWAPI: ProtocolBlueprint = {
    id: 'newapi',
    name: 'NewAPI / OneAPI 中转',
    description: 'NewAPI / OneAPI / FastAPI-LLM 等中转服务,OpenAI 兼容协议',
    icon: '🔀',
    builtIn: true,
    defaultBaseUrl: 'https://your-newapi-domain.com/v1',
    auth: {
        location: 'header',
        name: 'Authorization',
        valuePattern: 'Bearer {key}'
    },
    chatEndpoint: '{baseUrl}/chat/completions',
    listModels: {
        endpoint: '{baseUrl}/models'
    },
    schema: {
        messageFormat: 'openai',
        responsePath: 'choices.0.message.content',
        streamChunkPath: 'choices.0.delta.content',
        modelListPath: 'data',
        modelIdField: 'id'
    }
}

// ========== Anthropic 原生 ==========

export const PRESET_ANTHROPIC: ProtocolBlueprint = {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Anthropic Claude 官方原生协议',
    icon: '🟠',
    builtIn: true,
    defaultBaseUrl: 'https://api.anthropic.com',
    auth: {
        location: 'header',
        name: 'x-api-key',
        valuePattern: '{key}',
        extra: {
            'anthropic-version': '2023-06-01'
        }
    },
    chatEndpoint: '{baseUrl}/v1/messages',
    listModels: {
        endpoint: '{baseUrl}/v1/models'
    },
    schema: {
        messageFormat: 'anthropic',
        responsePath: 'content',
        fieldMap: {
            system: 'system'
        },
        streamChunkPath: 'delta.text',
        streamConditionField: 'type',
        streamConditionValue: 'content_block_delta',
        modelListPath: 'data',
        modelIdField: 'id'
    }
}

// ========== Google Gemini ==========

export const PRESET_GEMINI: ProtocolBlueprint = {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Google Gemini 原生 API',
    icon: '✨',
    builtIn: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    auth: {
        location: 'query',
        name: 'key',
        valuePattern: '{key}'
    },
    chatEndpoint: '{baseUrl}/v1beta/models/{model}:generateContent',
    listModels: {
        endpoint: '{baseUrl}/v1beta/models'
    },
    schema: {
        messageFormat: 'gemini',
        responsePath: 'candidates.0.content.parts.0.text',
        streamChunkPath: 'candidates.0.content.parts.0.text',
        modelListPath: 'models',
        modelIdField: 'name',
        stripModelPrefix: true
    }
}

// ========== Ollama ==========

export const PRESET_OLLAMA: ProtocolBlueprint = {
    id: 'ollama',
    name: 'Ollama 本地',
    description: '本地部署的 Ollama 服务,无需 API Key',
    icon: '🦙',
    builtIn: true,
    defaultBaseUrl: 'http://localhost:11434',
    auth: {
        location: 'none'
    },
    chatEndpoint: '{baseUrl}/v1/chat/completions',
    listModels: {
        endpoint: '{baseUrl}/api/tags'
    },
    schema: {
        messageFormat: 'openai',
        responsePath: 'choices.0.message.content',
        streamChunkPath: 'choices.0.delta.content',
        modelListPath: 'models',
        modelIdField: 'name'
    }
}

// ========== 智谱 GLM ==========

export const PRESET_ZHIPU: ProtocolBlueprint = {
    id: 'zhipu',
    name: '智谱 AI (GLM)',
    description: '智谱 AI - GLM 系列模型',
    icon: '🧠',
    builtIn: true,
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    auth: {
        location: 'header',
        name: 'Authorization',
        valuePattern: 'Bearer {key}'
    },
    chatEndpoint: '{baseUrl}/chat/completions',
    schema: {
        messageFormat: 'openai',
        responsePath: 'choices.0.message.content',
        streamChunkPath: 'choices.0.delta.content',
        modelListPath: 'data',
        modelIdField: 'id'
    }
}

// ========== 通义千问 (DashScope) ==========

export const PRESET_DASHSCOPE: ProtocolBlueprint = {
    id: 'dashscope',
    name: '通义千问 (DashScope)',
    description: '阿里云灵积 - 通义千问原生协议 (非 OpenAI 兼容模式)',
    icon: '🌊',
    builtIn: true,
    defaultBaseUrl: 'https://dashscope.aliyuncs.com',
    auth: {
        location: 'header',
        name: 'Authorization',
        valuePattern: 'Bearer {key}'
    },
    chatEndpoint: '{baseUrl}/api/v1/services/aigc/text-generation/generation',
    schema: {
        messageFormat: 'openai',
        fieldMap: {
            messages: 'input.messages'
        },
        responsePath: 'output.text',
        streamChunkPath: 'output.text',
        extraBody: {
            parameters: { result_format: 'message' }
        }
    }
}

// ========== 文心一言 (千帆) ==========

export const PRESET_QIANFAN: ProtocolBlueprint = {
    id: 'qianfan',
    name: '文心一言 (千帆)',
    description: '百度千帆 - 文心一言协议 (注意: 需要先用 access_token 鉴权,这里假定已用兼容模式)',
    icon: '🐦',
    builtIn: true,
    defaultBaseUrl: 'https://qianfan.baidubce.com/v2',
    auth: {
        location: 'header',
        name: 'Authorization',
        valuePattern: 'Bearer {key}'
    },
    chatEndpoint: '{baseUrl}/chat/completions',
    schema: {
        messageFormat: 'openai',
        responsePath: 'choices.0.message.content',
        streamChunkPath: 'choices.0.delta.content',
        modelListPath: 'data',
        modelIdField: 'id'
    }
}

// ========== Cohere ==========

export const PRESET_COHERE: ProtocolBlueprint = {
    id: 'cohere',
    name: 'Cohere Command',
    description: 'Cohere 原生协议',
    icon: '💎',
    builtIn: true,
    defaultBaseUrl: 'https://api.cohere.ai',
    auth: {
        location: 'header',
        name: 'Authorization',
        valuePattern: 'Bearer {key}'
    },
    chatEndpoint: '{baseUrl}/v2/chat',
    listModels: {
        endpoint: '{baseUrl}/v1/models'
    },
    schema: {
        messageFormat: 'openai',
        responsePath: 'message.content.0.text',
        streamChunkPath: 'delta.message.content.text',
        modelListPath: 'models',
        modelIdField: 'name'
    }
}

// ========== Mistral ==========

export const PRESET_MISTRAL: ProtocolBlueprint = {
    id: 'mistral',
    name: 'Mistral AI',
    description: 'Mistral 原生 API (OpenAI 兼容)',
    icon: '🌬️',
    builtIn: true,
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    auth: {
        location: 'header',
        name: 'Authorization',
        valuePattern: 'Bearer {key}'
    },
    chatEndpoint: '{baseUrl}/chat/completions',
    listModels: {
        endpoint: '{baseUrl}/models'
    },
    schema: {
        messageFormat: 'openai',
        responsePath: 'choices.0.message.content',
        streamChunkPath: 'choices.0.delta.content',
        modelListPath: 'data',
        modelIdField: 'id'
    }
}

// ========== 完整列表 ==========

export const ALL_PRESETS: ProtocolBlueprint[] = [
    PRESET_OPENAI,
    PRESET_NEWAPI,
    PRESET_ANTHROPIC,
    PRESET_GEMINI,
    PRESET_OLLAMA,
    PRESET_ZHIPU,
    PRESET_DASHSCOPE,
    PRESET_QIANFAN,
    PRESET_COHERE,
    PRESET_MISTRAL
]

export const PRESET_MAP: Record<string, ProtocolBlueprint> = Object.fromEntries(
    ALL_PRESETS.map(p => [p.id, p])
)

/**
 * 获取所有蓝图 (内置 + 用户自定义)
 */
export function getAllBlueprints(customs: ProtocolBlueprint[] = []): ProtocolBlueprint[] {
    return [...ALL_PRESETS, ...customs]
}

/**
 * 根据 ID 查找蓝图
 */
export function findBlueprint(
    id: string,
    customs: ProtocolBlueprint[] = []
): ProtocolBlueprint | null {
    return PRESET_MAP[id] || customs.find(b => b.id === id) || null
}
