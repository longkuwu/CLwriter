/**
 * Viral Agent - 爆文拆解与仿写引擎
 * 
 * 核心功能：
 * 1. 拆解爆文结构和情绪曲线
 * 2. 注入新主题生成仿写
 */

import { chatCompletion, streamChatCompletion } from '../tauri-api'

// 拆解结果
export interface DeconstructResult {
    // 节奏骨架
    structure: Array<{
        stage: string       // 阶段名称
        wordCount: number   // 字数
        description: string // 描述
    }>
    // 情绪曲线
    moodCurve: Array<{
        position: string    // 位置（如 "开篇"、"中段"）
        mood: string        // 情绪（如 "压抑"、"爆发"、"爽"）
        intensity: number   // 强度 1-10
    }>
    // 核心套路
    techniques: string[]
    // 原文摘要
    summary: string
}

// 仿写配置
export interface ImitationConfig {
    structure: DeconstructResult['structure']
    moodCurve: DeconstructResult['moodCurve']
    topic: string           // 用户主题
    styleGuide?: string     // 风格胶囊指导
}

// 拆解 Prompt
const DECONSTRUCT_PROMPT = `你是一个爆文分析专家。请深度拆解以下文章，提取其"爆款密码"。

【输出格式】
请严格输出 JSON，不要任何其他文字：
{
  "structure": [
    { "stage": "极速冲突开篇", "wordCount": 300, "description": "用强烈矛盾抓住读者" },
    { "stage": "金手指引入", "wordCount": 500, "description": "主角获得逆天能力" },
    { "stage": "第一次打脸", "wordCount": 800, "description": "狠狠打脸看不起他的人" }
  ],
  "moodCurve": [
    { "position": "开篇", "mood": "压抑/屈辱", "intensity": 8 },
    { "position": "转折", "mood": "惊喜/希望", "intensity": 6 },
    { "position": "高潮", "mood": "爽/解气", "intensity": 10 }
  ],
  "techniques": [
    "开篇 300 字必有矛盾",
    "每 500 字一个小爽点",
    "用对话推动剧情"
  ],
  "summary": "一句话概括这篇文章的核心套路"
}

【分析要点】
1. 结构：分析文章的节奏节点，每个阶段的字数和作用
2. 情绪：分析读者情绪变化曲线，从低谷到高潮
3. 套路：提炼可复用的写作技巧`

// 仿写 Prompt
const IMITATION_PROMPT = `你是一个爆文仿写大师。请严格按照给定的"节奏骨架"，创作一个全新的故事。

【参考骨架】
{STRUCTURE}

【情绪曲线】
{MOOD_CURVE}

【核心主题】
{TOPIC}

{STYLE_GUIDE}

【任务要求】
1. 严格按照"参考骨架"的节奏和字数结构来写
2. 情绪走向必须匹配"情绪曲线"
3. 只模仿结构和节奏，不抄袭具体文字
4. 融入"核心主题"的元素
5. 开篇必须在 300 字内制造强烈冲突

开始创作：`

/**
 * 拆解爆文结构
 */
export async function deconstructArticle(content: string): Promise<DeconstructResult | null> {
    if (!content || content.length < 200) {
        console.warn('[ViralAgent] 内容太短，无法拆解')
        return null
    }

    try {
        console.log(`[ViralAgent] 开始拆解爆文，长度: ${content.length}`)

        const response = await chatCompletion(
            [
                { role: 'system', content: DECONSTRUCT_PROMPT },
                { role: 'user', content: content.slice(0, 8000) }  // 最多分析 8000 字
            ],
            { maxTokens: 2000, temperature: 0.3 }
        )

        // 解析 JSON
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            console.error('[ViralAgent] 无法解析响应为 JSON')
            return null
        }

        const result = JSON.parse(jsonMatch[0]) as DeconstructResult
        console.log('[ViralAgent] 拆解成功:', result)
        return result

    } catch (error) {
        console.error('[ViralAgent] 拆解失败:', error)
        return null
    }
}

/**
 * 结构化仿写
 */
export async function generateImitation(
    config: ImitationConfig,
    onChunkCallback: (chunk: string) => void
): Promise<string> {
    try {
        console.log('[ViralAgent] 开始结构化仿写...')

        // 构建结构描述
        const structureText = config.structure
            .map((s, i) => `${i + 1}. 【${s.stage}】约 ${s.wordCount} 字 - ${s.description}`)
            .join('\n')

        // 构建情绪曲线描述
        const moodText = config.moodCurve
            .map(m => `- ${m.position}: ${m.mood} (强度 ${m.intensity}/10)`)
            .join('\n')

        // 替换 Prompt 模板
        const prompt = IMITATION_PROMPT
            .replace('{STRUCTURE}', structureText)
            .replace('{MOOD_CURVE}', moodText)
            .replace('{TOPIC}', config.topic)
            .replace('{STYLE_GUIDE}', config.styleGuide
                ? `【风格指导】\n${config.styleGuide}`
                : '')

        let fullContent = ''

        // 定义回调对象
        const streamCallbacks = {
            onChunk: (chunk: string) => {
                fullContent += chunk
                // 确保回调存在
                if (onChunkCallback && typeof onChunkCallback === 'function') {
                    onChunkCallback(chunk)
                }
            },
            onDone: () => {
                console.log('[ViralAgent] 流式生成完成')
            },
            onError: (error: string) => {
                console.error('[ViralAgent] 流式生成错误:', error)
            }
        }

        // 流式生成 - 使用正确的参数签名
        await streamChatCompletion(
            [
                { role: 'system', content: '你是一个专业的网络小说写手，擅长写爆款短文。' },
                { role: 'user', content: prompt }
            ],
            streamCallbacks,
            {
                // options 对象
                maxTokens: 4000,
                temperature: 0.8,
            }
        )

        console.log(`[ViralAgent] 仿写完成，共 ${fullContent.length} 字`)
        return fullContent

    } catch (error) {
        console.error('[ViralAgent] 仿写失败:', error)
        throw error
    }
}

/**
 * 计算节奏吻合度
 */
export function calculateRhythmMatch(
    originalStructure: DeconstructResult['structure'],
    newContent: string
): number {
    // 简单计算：根据总字数比例
    const targetTotal = originalStructure.reduce((sum, s) => sum + s.wordCount, 0)
    const actualLength = newContent.length

    const ratio = actualLength / targetTotal
    // 0.8-1.2 之间算高吻合
    if (ratio >= 0.8 && ratio <= 1.2) {
        return Math.round((1 - Math.abs(1 - ratio)) * 100)
    }
    return Math.max(0, Math.round((1 - Math.abs(1 - ratio) * 0.5) * 100))
}

// ========== 双轨分析系统 ==========

// 长文本阈值
export const LONG_TEXT_THRESHOLD = 30000

// 轨道 A：短文分析结果（简单 Beat Sheet）
export interface ShortTextBeat {
    beat: string           // 节拍名
    content: string        // 内容描述
    mood?: string          // 情绪（可选）
}

// 轨道 B：长文分析结果（分章节蓝图）
export interface LongTextBlueprint {
    chapters: Array<{
        chapter: number
        summary: string    // 章节摘要
        function: string   // 结构功能
        wordCount: number  // 估算字数
    }>
    overallTheme: string   // 全书主题
    totalChapters: number
}

// 切片分析结果
interface ChunkAnalysis {
    chunkIndex: number
    coreEvent: string      // 核心事件
    function: string       // 结构功能
    characters: string[]   // 涉及角色
    mood: string           // 情绪
}

// Track A Prompt
const SHORT_TEXT_PROMPT = `你是一个爆文分析专家。分析这篇短文的"情绪曲线"和"单章结构"。

【输出格式】
请严格输出 JSON 数组，描述文章的节拍：
[
  { "beat": "开头", "content": "主角被羞辱/压抑的开场", "mood": "压抑" },
  { "beat": "转折", "content": "获得金手指/机会", "mood": "期待" },
  { "beat": "高潮", "content": "打脸反派/扬眉吐气", "mood": "爽" },
  { "beat": "收尾", "content": "铺垫下一个冲突", "mood": "悬念" }
]

【分析要点】
1. 每个节拍用 2-3 句话描述内容
2. 标注情绪：压抑/期待/震惊/爽/燃/感动/悬念
3. 节拍数量 3-8 个，视文章长度而定`

// Track B Chunk Prompt
const CHUNK_ANALYSIS_PROMPT = `你是一个小说结构分析专家。分析这段文本在故事中的作用。

【输出格式】
请严格输出 JSON：
{
  "coreEvent": "这段发生的核心事件（一句话）",
  "function": "结构功能：开篇/铺垫/转折/高潮/过渡/收尾",
  "characters": ["涉及的角色名"],
  "mood": "情绪：压抑/期待/震惊/爽/燃/感动"
}

只分析这一段，不要推测其他部分。`

// Track B Reduce Prompt  
const REDUCE_PROMPT = `你是一个小说结构分析专家。根据以下各章节的分析结果，生成全书蓝图。

【各章节分析】
{CHUNK_ANALYSES}

【输出格式】
请严格输出 JSON：
{
  "chapters": [
    { "chapter": 1, "summary": "章节摘要", "function": "开篇/铺垫/高潮", "wordCount": 估算字数 },
    { "chapter": 2, "summary": "章节摘要", "function": "功能", "wordCount": 字数 }
  ],
  "overallTheme": "一句话概括全书主题",
  "totalChapters": 总章节数
}`

/**
 * 轨道 A：短文分析
 * 适用于 < 3万字的文章
 */
export async function analyzeShortText(content: string): Promise<ShortTextBeat[]> {
    console.log(`[ViralAgent] 轨道A：短文分析，长度 ${content.length}`)

    try {
        // 如果略超 context，进行一次性压缩（取首尾 + 中间采样）
        let processedContent = content
        if (content.length > 12000) {
            const head = content.slice(0, 4000)
            const mid = content.slice(Math.floor(content.length / 2) - 2000, Math.floor(content.length / 2) + 2000)
            const tail = content.slice(-4000)
            processedContent = `【开头】\n${head}\n\n【中间】\n${mid}\n\n【结尾】\n${tail}`
            console.log('[ViralAgent] 内容已压缩采样')
        }

        const response = await chatCompletion(
            [
                { role: 'system', content: SHORT_TEXT_PROMPT },
                { role: 'user', content: processedContent }
            ],
            { maxTokens: 2000, temperature: 0.3 }
        )

        const jsonMatch = response.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
            const beats = JSON.parse(jsonMatch[0]) as ShortTextBeat[]
            console.log(`[ViralAgent] 短文分析完成，提取 ${beats.length} 个节拍`)
            return beats
        }

        return []
    } catch (error) {
        console.error('[ViralAgent] 短文分析失败:', error)
        return []
    }
}

/**
 * 轨道 B：长文分析（Chunk-Map-Reduce）
 * 适用于 >= 3万字的文章
 */
export async function analyzeLongText(
    content: string,
    onProgress?: (step: string, progress: number) => void
): Promise<LongTextBlueprint | null> {
    console.log(`[ViralAgent] 轨道B：长文分析，长度 ${content.length}`)

    try {
        // Step 1: Chunking - 按 5000 字切分
        onProgress?.('切分文本...', 5)
        const chunkSize = 5000
        const chunks: string[] = []

        for (let i = 0; i < content.length; i += chunkSize) {
            chunks.push(content.slice(i, i + chunkSize))
        }
        console.log(`[ViralAgent] 切分为 ${chunks.length} 个块`)

        // Step 2: Mapping - 并行分析每个切片
        const chunkAnalyses: ChunkAnalysis[] = []

        for (let i = 0; i < chunks.length; i++) {
            const progress = 10 + Math.round((i / chunks.length) * 70)
            onProgress?.(`分析第 ${i + 1}/${chunks.length} 块...`, progress)

            try {
                const analysis = await analyzeChunk(chunks[i], i)
                chunkAnalyses.push(analysis)
            } catch (error) {
                console.warn(`[ViralAgent] 块 ${i} 分析失败:`, error)
                chunkAnalyses.push({
                    chunkIndex: i,
                    coreEvent: `第${i + 1}部分`,
                    function: '过渡',
                    characters: [],
                    mood: '平稳'
                })
            }
        }

        // Step 3: Reducing - 合并为全书地图
        onProgress?.('生成全书蓝图...', 85)
        const blueprint = await reduceToBlueprint(chunkAnalyses)

        onProgress?.('分析完成！', 100)
        console.log(`[ViralAgent] 长文分析完成，共 ${blueprint?.totalChapters || 0} 章`)

        return blueprint

    } catch (error) {
        console.error('[ViralAgent] 长文分析失败:', error)
        return null
    }
}

/**
 * 分析单个切片
 */
async function analyzeChunk(chunk: string, index: number): Promise<ChunkAnalysis> {
    const response = await chatCompletion(
        [
            { role: 'system', content: CHUNK_ANALYSIS_PROMPT },
            { role: 'user', content: chunk.slice(0, 5000) }
        ],
        { maxTokens: 500, temperature: 0.3 }
    )

    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
            chunkIndex: index,
            coreEvent: parsed.coreEvent || '未识别',
            function: parsed.function || '过渡',
            characters: parsed.characters || [],
            mood: parsed.mood || '平稳'
        }
    }

    throw new Error('无法解析切片分析结果')
}

/**
 * 归约为全书蓝图
 */
async function reduceToBlueprint(analyses: ChunkAnalysis[]): Promise<LongTextBlueprint | null> {
    // 构建分析摘要
    const analysesText = analyses.map((a, i) =>
        `第${i + 1}块：${a.coreEvent} (${a.function}, ${a.mood})`
    ).join('\n')

    const prompt = REDUCE_PROMPT.replace('{CHUNK_ANALYSES}', analysesText)

    const response = await chatCompletion(
        [
            { role: 'system', content: '你是一个专业的小说结构分析师。' },
            { role: 'user', content: prompt }
        ],
        { maxTokens: 3000, temperature: 0.3 }
    )

    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as LongTextBlueprint
    }

    return null
}

/**
 * 智能分析入口（自动选择轨道）
 */
export async function smartAnalyze(
    content: string,
    onProgress?: (step: string, progress: number) => void
): Promise<{ type: 'short'; data: ShortTextBeat[] } | { type: 'long'; data: LongTextBlueprint } | null> {
    if (content.length < LONG_TEXT_THRESHOLD) {
        // 轨道 A
        const beats = await analyzeShortText(content)
        return beats.length > 0 ? { type: 'short', data: beats } : null
    } else {
        // 轨道 B
        const blueprint = await analyzeLongText(content, onProgress)
        return blueprint ? { type: 'long', data: blueprint } : null
    }
}
