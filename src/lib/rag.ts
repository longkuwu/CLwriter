/**
 * RAG (Retrieval Augmented Generation) 模块
 * 
 * 实现检索增强生成流程：
 * 1. 接收用户指令
 * 2. 向量搜索相关历史/设定
 * 3. 组装上下文增强的 Prompt
 * 4. 调用 AI 生成 (通过 Tauri 代理)
 */

import { searchMemory } from './memory'
import { chatCompletion, streamChatCompletion } from './tauri-api'
import { buildStoryHistoryPrompt } from './ai/summary'

/**
 * RAG 生成选项
 */
export interface RAGOptions {
    /** 用户输入的指令 */
    instruction: string
    /** 小说 ID (用于检索相关记忆) */
    novelId: string
    /** 检索的记忆数量 */
    topK?: number
    /** 相似度阈值 (0-1)，低于此值的结果不会被使用 */
    similarityThreshold?: number
    /** 额外的系统提示 */
    systemPrompt?: string
    /** AI 生成参数 */
    maxTokens?: number
    temperature?: number
}

/**
 * RAG 生成结果
 */
export interface RAGResult {
    /** 生成的文本 */
    text: string
    /** 检索到的上下文记忆 */
    retrievedMemories: Array<{ content: string; similarity: number }>
    /** 实际使用的完整 Prompt (用于调试) */
    fullPrompt: string
}

/**
 * 构建 RAG Prompt
 */
function buildRAGPrompt(
    instruction: string,
    memories: Array<{ content: string; similarity: number }>
): string {
    if (memories.length === 0) {
        return instruction
    }

    const contextSection = memories
        .map((m, i) => `[${i + 1}] ${m.content}`)
        .join('\n\n')

    return `[Context Memories]
以下是与当前创作相关的历史内容和设定：

${contextSection}

---

[Instruction]
基于以上历史与设定，请继续扩写：

${instruction}`
}

/**
 * 构建增强版 RAG Prompt（包含章节摘要 + RAG 记忆 + 滚动摘要）
 */
import { buildRollingSummaryPrompt } from './actions/summaries'

async function buildEnhancedRAGPrompt(
    instruction: string,
    memories: Array<{ content: string; similarity: number }>,
    novelId: string,
    projectId?: string
): Promise<string> {
    // 获取最近 5 章摘要 (基于 chapters 表)
    const storyHistory = await buildStoryHistoryPrompt(novelId)

    // 获取滚动摘要 (基于 summaries 表，项目级别)
    const rollingSummary = projectId
        ? await buildRollingSummaryPrompt(projectId)
        : ''

    // 构建微观细节
    const relevantDetails = memories.length > 0
        ? memories.map((m, i) => `[${i + 1}] ${m.content}`).join('\n\n')
        : '（暂无相关细节记录）'

    // 合并宏观剧情（优先使用滚动摘要）
    const macroContext = rollingSummary || storyHistory || ''

    return `${macroContext}[Relevant Details - RAG 检索的微观细节]
${relevantDetails}

---

[Instruction]
基于以上宏观剧情和微观设定，请继续扩写：

${instruction}`
}


/**
 * 默认系统提示 (集成 Humanizer 规则)
 */
import { getHumanizerSystemPrompt } from './ai/humanizer'

const BASE_PROMPT = `你是一个专业的小说作家助手。
你的任务是根据提供的历史上下文和用户指令，创作连贯、生动的小说内容。`

const DEFAULT_SYSTEM_PROMPT = getHumanizerSystemPrompt(BASE_PROMPT)

/**
 * RAG 增强的文本生成 (非流式)
 */
export async function generateWithRAG(options: RAGOptions): Promise<RAGResult> {
    const {
        instruction,
        novelId,
        topK = 5,
        similarityThreshold = 0.3,
        systemPrompt = DEFAULT_SYSTEM_PROMPT,
        maxTokens = 2048,
        temperature = 0.7,
    } = options

    console.log(`[RAG] 开始检索相关记忆，指令: "${instruction.slice(0, 50)}..."`)

    // 1. 搜索相关记忆 (Recall)
    let retrievedMemories: Array<{ content: string; similarity: number }> = []

    try {
        const searchResults = await searchMemory(novelId, instruction, topK)
        retrievedMemories = searchResults.filter(m => m.similarity >= similarityThreshold)
        console.log(`[RAG] 检索到 ${searchResults.length} 条记忆，过滤后保留 ${retrievedMemories.length} 条`)
    } catch (error) {
        console.warn('[RAG] 记忆检索失败，将使用无上下文模式:', error)
    }

    // 2. 组装 Prompt
    const fullPrompt = buildRAGPrompt(instruction, retrievedMemories)
    console.log(`[RAG] Prompt 组装完成，长度: ${fullPrompt.length} 字符`)

    // 3. 调用 AI 生成 (通过 Tauri 代理)
    const text = await chatCompletion(
        [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: fullPrompt },
        ],
        { maxTokens, temperature }
    )

    return {
        text,
        retrievedMemories,
        fullPrompt,
    }
}

/**
 * RAG 增强的流式文本生成
 */
export interface StreamRAGOptions extends RAGOptions {
    /** 文本生成回调 */
    onText?: (text: string) => void
    /** 记忆检索完成回调 - 用于 UI 展示思维链 */
    onMemoriesRetrieved?: (memories: Array<{ content: string; similarity: number }>) => void
    /** 自定义 Prompt 构建器 - 用于节点导航模式 */
    customPromptBuilder?: (instruction: string, memories: Array<{ content: string; similarity: number }>) => string
}

export async function streamWithRAG(options: StreamRAGOptions): Promise<RAGResult> {
    const {
        instruction,
        novelId,
        topK = 5,
        similarityThreshold = 0.3,
        systemPrompt = DEFAULT_SYSTEM_PROMPT,
        maxTokens = 2048,
        temperature = 0.7,
        onText,
        onMemoriesRetrieved,
        customPromptBuilder,
    } = options

    console.log(`[RAG] 开始流式生成，指令: "${instruction.slice(0, 50)}..."`)

    // 1. 搜索相关记忆
    let retrievedMemories: Array<{ content: string; similarity: number }> = []

    try {
        const searchResults = await searchMemory(novelId, instruction, topK)
        retrievedMemories = searchResults.filter(m => m.similarity >= similarityThreshold)
        console.log(`[RAG] 检索到 ${retrievedMemories.length} 条相关记忆`)

        // 通知 UI 记忆检索完成
        onMemoriesRetrieved?.(retrievedMemories)
    } catch (error) {
        console.warn('[RAG] 记忆检索失败:', error)
        onMemoriesRetrieved?.([])  // 通知 UI 检索完成（空结果）
    }

    // 2. 组装 Prompt - 支持自定义构建器，或使用增强版（包含章节摘要）
    let fullPrompt: string
    if (customPromptBuilder) {
        fullPrompt = customPromptBuilder(instruction, retrievedMemories)
    } else {
        // 使用增强版 Prompt（包含 Story So Far + RAG 细节）
        fullPrompt = await buildEnhancedRAGPrompt(instruction, retrievedMemories, novelId)
    }

    // 3. 流式生成 (通过 Tauri 代理)
    let generatedText = ''

    await streamChatCompletion(
        [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: fullPrompt },
        ],
        {
            onChunk: (chunk) => {
                generatedText += chunk
                onText?.(chunk)
            },
            onDone: () => {
                console.log('[RAG] 流式生成完成')
            },
            onError: (error) => {
                console.error('[RAG] 流式生成错误:', error)
            },
        },
        { maxTokens, temperature }
    )

    return {
        text: generatedText,
        retrievedMemories,
        fullPrompt,
    }
}

