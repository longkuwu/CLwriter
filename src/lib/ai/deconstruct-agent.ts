/**
 * Deconstruct Agent - 长文结构映射服务
 * 
 * 核心功能：处理 10万字+ 超长文本的分布式分析
 * 
 * 流程：
 * 1. 宏观扫描 (Macro Scan) - 抽取 10% 样本，提取核心梗和主线
 * 2. 微观切片 (Micro Slice) - 逐块分析事件、功能、字数
 * 3. 输出动态骨架 (Dynamic Beat Sheet)
 */

import { chatCompletion } from '../tauri-api'
import { chunkText, type TextChunk, type ChunkResult } from '../utils/chunker'

// ========== 类型定义 ==========

// 动态骨架节拍
export interface BeatItem {
    chapter: number
    beat: string           // 节拍名称
    wordCount: number      // 字数
    function: string       // 功能描述
    mood: string           // 情绪
    ratio?: number         // 占比百分比
}

// 宏观分析结果
export interface MacroAnalysis {
    corePlot: string       // 核心梗概
    mainLine: string       // 全书主线
    genre: string          // 类型判断
    keyTurns: string[]     // 关键转折点
}

// 微观分析结果（单个切片）
export interface MicroAnalysis {
    chunkIndex: number
    plot: string           // 发生了什么
    function: string       // 段落功能
    mood: string           // 情绪
    wordCount: number
}

// 完整分析结果
export interface StructureAnalysis {
    macro: MacroAnalysis
    beats: BeatItem[]
    totalWordCount: number
    totalChapters: number
}

// 平台类型
export type PlatformType = 'tomato' | 'zhihu' | 'toutiao'

// ========== Prompt 模板 ==========

// 宏观扫描 Prompt
const MACRO_SCAN_PROMPT = `你是一位资深网络小说编辑。请根据以下文章的【关键片段】，快速总结出这篇文章的核心信息。

【输出格式】
请严格输出 JSON，不要任何其他文字：
{
  "corePlot": "一句话概括核心卖点/爆点",
  "mainLine": "主角从A到B的主线剧情",
  "genre": "类型：如都市重生、玄幻升级、悬疑推理等",
  "keyTurns": ["转折点1", "转折点2", "转折点3"]
}

【分析要点】
1. 核心卖点：读者为什么会被吸引？
2. 主线剧情：主角的处境变化
3. 关键转折：故事发生质变的节点`

// 微观切片 Prompt（根据平台调整）
const MICRO_SLICE_PROMPTS: Record<PlatformType, string> = {
    tomato: `你是番茄/百度平台的爆文分析专家。分析这段文字的"爽文结构"。

【重点关注】
- 是否在制造"打脸"场景？
- 是否有"金手指"展示？
- 爽点密度如何？
- 是否在"拉仇恨"铺垫反派？

【输出格式】
{
  "plot": "这段发生了什么事",
  "function": "这段的结构功能：开篇冲突/拉仇恨铺垫/金手指展示/第N次打脸/升级突破/收服小弟/装逼打脸",
  "mood": "读者情绪：压抑/期待/震惊/爽/燃/感动"
}`,

    zhihu: `你是知乎/公众号平台的爆文分析专家。分析这段文字的"情绪钩子"。

【重点关注】
- 第一人称叙事的代入感如何？
- 是否有"社会痛点"共鸣？
- 反转钩子在哪里？
- 情绪煽动程度？

【输出格式】
{
  "plot": "这段发生了什么事",
  "function": "这段的结构功能：悬念开篇/痛点共鸣/情绪铺垫/反转揭示/深度升华/情感收尾",
  "mood": "读者情绪：好奇/共鸣/愤怒/惊讶/感慨/治愈"
}`,

    toutiao: `你是头条/故事平台的爆文分析专家。分析这段文字的"猎奇吸引力"。

【重点关注】
- 开头是否足够抓眼球？
- 是否有"震惊体"元素？
- 情绪煽动是否到位？
- 是否有"反常识"冲突？

【输出格式】
{
  "plot": "这段发生了什么事",
  "function": "这段的结构功能：猎奇开篇/冲突制造/情绪煽动/悬念吊胃口/高潮爆发/结局反转",
  "mood": "读者情绪：震惊/好奇/愤怒/解气/感动/意外"
}`
}

// ========== 核心函数 ==========

/**
 * 执行完整的结构映射分析
 * 
 * @param text 全文内容
 * @param platform 来源平台
 * @param onProgress 进度回调
 * @returns 完整分析结果
 */
export async function analyzeStructure(
    text: string,
    platform: PlatformType = 'tomato',
    onProgress?: (step: string, progress: number) => void
): Promise<StructureAnalysis> {
    console.log(`[DeconstructAgent] 开始结构映射分析，平台: ${platform}`)

    // Step 0: 切分文本
    onProgress?.('准备切分文本...', 5)
    const chunkResult = chunkText(text, 4000)
    console.log(`[DeconstructAgent] 切分完成: ${chunkResult.metadata.totalChunks} 块`)

    // Step 1: 宏观扫描（10% 采样）
    onProgress?.('宏观扫描中...', 10)
    const macro = await macroScan(text, chunkResult)
    console.log('[DeconstructAgent] 宏观分析完成:', macro)

    // Step 2: 微观切片（逐块分析）
    const microResults: MicroAnalysis[] = []
    const totalChunks = chunkResult.chunks.length

    for (let i = 0; i < totalChunks; i++) {
        const chunk = chunkResult.chunks[i]
        const progress = 20 + Math.round((i / totalChunks) * 70)
        onProgress?.(`分析第 ${i + 1}/${totalChunks} 块...`, progress)

        try {
            const micro = await microSlice(chunk, platform)
            microResults.push(micro)
        } catch (error) {
            console.warn(`[DeconstructAgent] 块 ${i} 分析失败:`, error)
            // 失败时使用默认值
            microResults.push({
                chunkIndex: i,
                plot: chunk.title || `第${i + 1}部分`,
                function: '过渡段落',
                mood: '平稳',
                wordCount: chunk.wordCount
            })
        }
    }

    // Step 3: 合成动态骨架
    onProgress?.('生成动态骨架...', 95)
    const beats = synthesizeBeatSheet(microResults, chunkResult.metadata.totalWordCount)

    onProgress?.('分析完成！', 100)

    return {
        macro,
        beats,
        totalWordCount: chunkResult.metadata.totalWordCount,
        totalChapters: chunkResult.metadata.estimatedChapters
    }
}

/**
 * 宏观扫描 - 抽取 10% 关键位置进行总结
 */
async function macroScan(text: string, chunkResult: ChunkResult): Promise<MacroAnalysis> {
    const chunks = chunkResult.chunks
    const totalLength = text.length

    // 抽取关键片段：开头、结尾、中间关键点
    const samples: string[] = []

    // 开头 5%
    const headEnd = Math.min(Math.floor(totalLength * 0.05), 3000)
    samples.push(`【开头片段】\n${text.slice(0, headEnd)}`)

    // 结尾 5%
    const tailStart = Math.max(totalLength - Math.floor(totalLength * 0.05), totalLength - 3000)
    samples.push(`【结尾片段】\n${text.slice(tailStart)}`)

    // 中间关键点（1/4, 1/2, 3/4 位置各取一点）
    const positions = [0.25, 0.5, 0.75]
    for (const pos of positions) {
        const start = Math.floor(totalLength * pos)
        const end = Math.min(start + 1500, totalLength)
        samples.push(`【${Math.round(pos * 100)}% 位置片段】\n${text.slice(start, end)}`)
    }

    const sampledText = samples.join('\n\n---\n\n')

    try {
        const response = await chatCompletion(
            [
                { role: 'system', content: MACRO_SCAN_PROMPT },
                { role: 'user', content: sampledText.slice(0, 12000) }
            ],
            { maxTokens: 1000, temperature: 0.3 }
        )

        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]) as MacroAnalysis
        }
    } catch (error) {
        console.error('[DeconstructAgent] 宏观分析失败:', error)
    }

    // 返回默认值
    return {
        corePlot: '未能识别核心梗概',
        mainLine: '未能识别主线剧情',
        genre: '未知类型',
        keyTurns: []
    }
}

/**
 * 微观切片 - 分析单个 Chunk
 */
async function microSlice(chunk: TextChunk, platform: PlatformType): Promise<MicroAnalysis> {
    const prompt = MICRO_SLICE_PROMPTS[platform]

    try {
        const response = await chatCompletion(
            [
                { role: 'system', content: prompt },
                { role: 'user', content: chunk.content.slice(0, 6000) }
            ],
            { maxTokens: 500, temperature: 0.4 }
        )

        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            return {
                chunkIndex: chunk.index,
                plot: parsed.plot || '未识别',
                function: parsed.function || '过渡',
                mood: parsed.mood || '平稳',
                wordCount: chunk.wordCount
            }
        }
    } catch (error) {
        console.warn(`[DeconstructAgent] 微观分析失败:`, error)
    }

    return {
        chunkIndex: chunk.index,
        plot: chunk.title || `段落 ${chunk.index + 1}`,
        function: '过渡段落',
        mood: '平稳',
        wordCount: chunk.wordCount
    }
}

/**
 * 合成动态骨架 - 将微观分析结果转为 Beat Sheet
 */
function synthesizeBeatSheet(microResults: MicroAnalysis[], totalWordCount: number): BeatItem[] {
    return microResults.map((m, index) => ({
        chapter: index + 1,
        beat: getBeatName(m.function, index, microResults.length),
        wordCount: m.wordCount,
        function: m.plot,
        mood: m.mood,
        ratio: Math.round((m.wordCount / totalWordCount) * 1000) / 10
    }))
}

/**
 * 根据功能生成节拍名称
 */
function getBeatName(func: string, index: number, total: number): string {
    // 根据位置和功能推断节拍名称
    const position = index / total

    if (position < 0.05) return '开篇切入'
    if (position < 0.15) return '矛盾建立'
    if (position < 0.25) return '转折触发'
    if (position < 0.5) return '发展推进'
    if (position < 0.75) return '高潮铺垫'
    if (position < 0.9) return '高潮爆发'
    return '结局收尾'
}

/**
 * 快速分析（用于短文本，直接调用 viral-agent）
 */
export async function quickAnalyze(text: string, platform: PlatformType = 'tomato'): Promise<BeatItem[]> {
    // 短文本直接返回简化结果
    const prompt = `分析这篇文章的结构，输出 JSON 数组：
[
  { "chapter": 1, "beat": "节拍名", "wordCount": 字数, "function": "功能", "mood": "情绪" }
]

【平台特点】${platform === 'tomato' ? '番茄爽文风格' : platform === 'zhihu' ? '知乎情感风格' : '头条猎奇风格'}`

    try {
        const response = await chatCompletion(
            [
                { role: 'system', content: prompt },
                { role: 'user', content: text.slice(0, 8000) }
            ],
            { maxTokens: 2000, temperature: 0.3 }
        )

        const jsonMatch = response.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]) as BeatItem[]
        }
    } catch (error) {
        console.error('[DeconstructAgent] 快速分析失败:', error)
    }

    return []
}

// ========== v5.2 三级自适应分析系统 ==========

import {
    LONG_TEXT_THRESHOLD,
    MEGA_TEXT_THRESHOLD,
    getAnalysisMode,
    type AnalysisMode
} from '../constants'

/**
 * 统一分析入口 - 自动选择分析级别
 * 
 * 🟢 Level A (<20k): 全息直通 - One-Shot 全文分析
 * 🟡 Level B (20k-60k): 智能切分 - 语义场景切分
 * 🟣 Level C (>60k): 宏观映射 - Map-Reduce 分块
 */
export async function analyzeText(
    text: string,
    platform: PlatformType = 'tomato',
    onProgress?: (step: string, progress: number) => void
): Promise<StructureAnalysis> {
    const wordCount = text.length
    const mode = getAnalysisMode(wordCount)

    console.log(`[DeconstructAgent] 分析模式: ${mode}, 字数: ${wordCount}`)

    switch (mode) {
        case 'lite':
            return analyzeLiteMode(text, platform, onProgress)
        case 'smart':
            return analyzeSmartMode(text, platform, onProgress)
        case 'mega':
            return analyzeStructure(text, platform, onProgress) // 已有的 Map-Reduce
    }
}

/**
 * 🟢 Level A: 全息直通 (<20k)
 * One-Shot 全文输入，提取微观情绪曲线、伏笔细节
 */
async function analyzeLiteMode(
    text: string,
    platform: PlatformType,
    onProgress?: (step: string, progress: number) => void
): Promise<StructureAnalysis> {
    console.log('[DeconstructAgent] 🟢 轻量模式 - 全息直通')
    onProgress?.('全息深度分析中...', 10)

    const LITE_PROMPT = `你是一位顶级爆文分析专家。请对这篇完整文章进行深度拆解。

【输出格式】
请严格输出 JSON：
{
  "macro": {
    "corePlot": "核心卖点（一句话）",
    "mainLine": "主线剧情发展",
    "genre": "类型判断",
    "keyTurns": ["转折点1", "转折点2"]
  },
  "beats": [
    { "chapter": 1, "beat": "节拍名", "wordCount": 估算字数, "function": "功能描述", "mood": "情绪" }
  ]
}

【分析要点 - ${platform === 'tomato' ? '番茄爽文' : platform === 'zhihu' ? '知乎情感' : '头条猎奇'}】
1. 情绪曲线：从低谷到爆发的节奏
2. 结构节拍：每个转折点的位置和作用
3. 核心套路：可复用的写作技巧`

    try {
        onProgress?.('AI 深度分析中...', 40)

        const response = await chatCompletion(
            [
                { role: 'system', content: LITE_PROMPT },
                { role: 'user', content: text.slice(0, 15000) }
            ],
            { maxTokens: 3000, temperature: 0.3 }
        )

        onProgress?.('解析结果...', 80)

        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            onProgress?.('分析完成！', 100)

            return {
                macro: parsed.macro || {
                    corePlot: '未识别',
                    mainLine: '未识别',
                    genre: '未知',
                    keyTurns: []
                },
                beats: parsed.beats || [],
                totalWordCount: text.length,
                totalChapters: parsed.beats?.length || 1
            }
        }
    } catch (error) {
        console.error('[DeconstructAgent] 轻量分析失败:', error)
    }

    onProgress?.('分析完成', 100)
    return {
        macro: { corePlot: '分析失败', mainLine: '', genre: '未知', keyTurns: [] },
        beats: [],
        totalWordCount: text.length,
        totalChapters: 0
    }
}

/**
 * 🟡 Level B: 智能切分 (20k-60k)
 * NLP 语义场景切分 - 识别时间跳跃/地点切换/视角转换
 */
async function analyzeSmartMode(
    text: string,
    platform: PlatformType,
    onProgress?: (step: string, progress: number) => void
): Promise<StructureAnalysis> {
    console.log('[DeconstructAgent] 🟡 智能模式 - 语义切分')
    onProgress?.('语义场景分析中...', 5)

    // Step 1: 语义切分 - 识别自然分割点
    onProgress?.('识别场景分割点...', 10)
    const sceneBreaks = await identifySceneBreaks(text)
    console.log(`[DeconstructAgent] 识别到 ${sceneBreaks.length} 个场景`)

    // Step 2: 按场景切分文本
    const scenes = splitBySceneBreaks(text, sceneBreaks)
    console.log(`[DeconstructAgent] 切分为 ${scenes.length} 个场景`)

    // Step 3: 宏观扫描
    onProgress?.('宏观扫描...', 20)
    const chunkResult = chunkText(text, 4000)
    const macro = await macroScan(text, chunkResult)

    // Step 4: 逐场景分析
    const microResults: MicroAnalysis[] = []
    for (let i = 0; i < scenes.length; i++) {
        const progress = 30 + Math.round((i / scenes.length) * 60)
        onProgress?.(`分析场景 ${i + 1}/${scenes.length}...`, progress)

        try {
            const micro = await analyzeScene(scenes[i], i, platform)
            microResults.push(micro)
        } catch (error) {
            console.warn(`[DeconstructAgent] 场景 ${i} 分析失败`)
            microResults.push({
                chunkIndex: i,
                plot: `场景 ${i + 1}`,
                function: '过渡',
                mood: '平稳',
                wordCount: scenes[i].length
            })
        }
    }

    onProgress?.('合成骨架...', 95)
    const beats = synthesizeBeatSheet(microResults, text.length)

    onProgress?.('分析完成！', 100)
    return {
        macro,
        beats,
        totalWordCount: text.length,
        totalChapters: scenes.length
    }
}

/**
 * 识别语义场景分割点
 * 检测：时间跳跃、地点切换、视角转换
 */
async function identifySceneBreaks(text: string): Promise<number[]> {
    const SCENE_BREAK_PROMPT = `你是一位专业的小说结构分析师。请识别这段文本中的"自然场景分割点"。

【识别标准】
1. 时间跳跃：如"第二天"、"三年后"、"夜幕降临"
2. 地点切换：如"回到家中"、"来到公司"、"走进酒店"
3. 视角转换：如"另一边"、"与此同时"、"回到某某视角"
4. 章节标记：如"第X章"、"===分割线==="

【输出格式】
输出 JSON 数组，包含每个分割点在原文中的大致位置（百分比）：
[0.15, 0.32, 0.48, 0.65, 0.82]

只输出数组，不要其他文字。`

    try {
        // 对于中等长度文本，采样分析
        const sampleSize = 8000
        const samples: string[] = []
        const step = Math.floor(text.length / 4)

        for (let i = 0; i < 4; i++) {
            const start = i * step
            const end = Math.min(start + sampleSize / 4, text.length)
            samples.push(`【${i * 25}%-${(i + 1) * 25}%】\n${text.slice(start, end)}`)
        }

        const response = await chatCompletion(
            [
                { role: 'system', content: SCENE_BREAK_PROMPT },
                { role: 'user', content: samples.join('\n\n---\n\n') }
            ],
            { maxTokens: 500, temperature: 0.2 }
        )

        const jsonMatch = response.match(/\[[\s\S]*?\]/)
        if (jsonMatch) {
            const breaks = JSON.parse(jsonMatch[0]) as number[]
            // 确保分割点在有效范围内
            return breaks.filter(b => b > 0.05 && b < 0.95).sort((a, b) => a - b)
        }
    } catch (error) {
        console.error('[DeconstructAgent] 场景识别失败:', error)
    }

    // 失败时按默认比例切分
    return [0.25, 0.5, 0.75]
}

/**
 * 根据场景分割点切分文本
 */
function splitBySceneBreaks(text: string, breaks: number[]): string[] {
    const scenes: string[] = []
    let lastPos = 0

    for (const breakPoint of breaks) {
        const pos = Math.floor(text.length * breakPoint)
        // 在分割点附近找换行符，避免切断句子
        const adjustedPos = findNearestBreak(text, pos)
        scenes.push(text.slice(lastPos, adjustedPos))
        lastPos = adjustedPos
    }

    // 添加最后一个场景
    if (lastPos < text.length) {
        scenes.push(text.slice(lastPos))
    }

    return scenes.filter(s => s.trim().length > 100)
}

/**
 * 找到最近的自然断点（换行/段落）
 */
function findNearestBreak(text: string, targetPos: number, range: number = 200): number {
    const start = Math.max(0, targetPos - range)
    const end = Math.min(text.length, targetPos + range)
    const segment = text.slice(start, end)

    // 优先找双换行（段落分隔）
    const paragraphBreak = segment.lastIndexOf('\n\n')
    if (paragraphBreak !== -1) {
        return start + paragraphBreak + 2
    }

    // 其次找单换行
    const lineBreak = segment.lastIndexOf('\n')
    if (lineBreak !== -1) {
        return start + lineBreak + 1
    }

    // 最后找句号
    const sentenceBreak = segment.lastIndexOf('。')
    if (sentenceBreak !== -1) {
        return start + sentenceBreak + 1
    }

    return targetPos
}

/**
 * 分析单个场景
 */
async function analyzeScene(
    scene: string,
    index: number,
    platform: PlatformType
): Promise<MicroAnalysis> {
    const prompt = MICRO_SLICE_PROMPTS[platform]

    try {
        const response = await chatCompletion(
            [
                { role: 'system', content: prompt },
                { role: 'user', content: scene.slice(0, 6000) }
            ],
            { maxTokens: 500, temperature: 0.4 }
        )

        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            return {
                chunkIndex: index,
                plot: parsed.plot || '未识别',
                function: parsed.function || '过渡',
                mood: parsed.mood || '平稳',
                wordCount: scene.length
            }
        }
    } catch (error) {
        console.warn(`[DeconstructAgent] 场景分析失败:`, error)
    }

    return {
        chunkIndex: index,
        plot: `场景 ${index + 1}`,
        function: '过渡',
        mood: '平稳',
        wordCount: scene.length
    }
}

// Re-export for convenience
export { getAnalysisMode, type AnalysisMode }
