/**
 * Deconstruct Agent - 长文本结构分析器
 * 
 * 功能：
 * 1. 分析长文本的章节结构
 * 2. 提取动态骨架（Beat Sheet）
 * 3. 识别宏观叙事模式
 */

import { chatCompletion } from '../tauri-api'
import { smartChunkText, type TextChunk } from '../utils/chunker'
import type { PlatformType } from '../constants'

// ========== 类型定义 ==========

/**
 * 单个节拍（Beat）
 */
export interface BeatItem {
    chapter: number          // 章节号
    beat: string             // 节拍名称
    function: string         // 结构功能
    mood: string             // 情绪
    wordCount: number        // 字数
}

/**
 * 宏观分析结果
 */
export interface MacroAnalysis {
    corePlot: string         // 核心情节
    keyTurns: string[]       // 关键转折点
    overallPacing: string    // 整体节奏评价
}

/**
 * 完整结构分析结果
 */
export interface StructureAnalysis {
    beats: BeatItem[]
    macro: MacroAnalysis
    totalChapters: number
    totalWords: number
}

// ========== Prompt 模板 ==========

/**
 * 切片分析 Prompt
 */
const CHUNK_ANALYSIS_PROMPT = `你是一个小说结构分析专家。分析这段文本在故事中的作用。

【输出格式】
请严格输出 JSON：
{
  "beat": "这段的核心节拍（如：开篇冲突、金手指获得、第一次打脸）",
  "function": "结构功能：开篇/铺垫/转折/高潮/过渡/收尾",
  "mood": "情绪：压抑/期待/震惊/爽/燃/感动/好奇/愤怒/解气/意外",
  "wordCount": 估算字数
}

只分析这一段，不要推测其他部分。`

/**
 * 宏观归约 Prompt
 */
const MACRO_REDUCE_PROMPT = `你是一个小说结构分析专家。根据以下各章节的分析结果，生成全书宏观分析。

【各章节分析】
{BEAT_LIST}

【输出格式】
请严格输出 JSON：
{
  "corePlot": "一句话概括核心情节",
  "keyTurns": ["关键转折点1", "关键转折点2", "关键转折点3"],
  "overallPacing": "整体节奏评价（如：前紧后松、层层递进、爽点密集）"
}`

/**
 * 平台特化 Prompt
 */
const PLATFORM_PROMPTS: Record<PlatformType, string> = {
    tomato: `【番茄/百度平台特征】
- 黄金三章：前3章必须有强冲突
- 爽点密度：每500字一个小爽点
- 打脸节奏：压抑-反转-打脸循环`,

    zhihu: `【知乎/公众号平台特征】
- 第一人称叙事
- 反转钩子：开头抛出悬念
- 社会痛点：共鸣感强`,

    toutiao: `【头条/故事平台特征】
- 猎奇开头：吸引眼球
- 情绪煽动：强烈情感共鸣
- 快节奏：不拖沓`
}

// ========== 核心函数 ==========

/**
 * 分析长文本结构
 * @param text 原始文本
 * @param platform 平台类型
 * @param onProgress 进度回调
 * @returns 结构分析结果
 */
export async function analyzeText(
    text: string,
    platform: PlatformType = 'tomato',
    onProgress?: (step: string, progress: number) => void
): Promise<StructureAnalysis | null> {
    try {
        onProgress?.('准备分析...', 0)

        // Step 1: 智能分块
        onProgress?.('切分文本...', 5)
        const { chunks, metadata } = smartChunkText(text, 5000)
        console.log(`[DeconstructAgent] 切分为 ${chunks.length} 块`)

        // Step 2: 逐块分析
        const beats: BeatItem[] = []
        const platformPrompt = PLATFORM_PROMPTS[platform]

        for (let i = 0; i < chunks.length; i++) {
            const progress = 10 + Math.round((i / chunks.length) * 70)
            onProgress?.(`分析第 ${i + 1}/${chunks.length} 块...`, progress)

            try {
                const beat = await analyzeChunk(chunks[i], i + 1, platformPrompt)
                beats.push(beat)
            } catch (error) {
                console.warn(`[DeconstructAgent] 块 ${i} 分析失败:`, error)
                // 使用默认值
                beats.push({
                    chapter: i + 1,
                    beat: `第${i + 1}部分`,
                    function: '过渡',
                    mood: '平稳',
                    wordCount: chunks[i].content.length
                })
            }
        }

        // Step 3: 宏观归约
        onProgress?.('生成宏观分析...', 85)
        const macro = await reduceMacro(beats)

        onProgress?.('分析完成！', 100)

        return {
            beats,
            macro,
            totalChapters: beats.length,
            totalWords: text.length
        }

    } catch (error) {
        console.error('[DeconstructAgent] 分析失败:', error)
        return null
    }
}

/**
 * 分析单个切片
 */
async function analyzeChunk(
    chunk: TextChunk,
    chapterNumber: number,
    platformPrompt: string
): Promise<BeatItem> {
    const systemPrompt = `${CHUNK_ANALYSIS_PROMPT}\n\n${platformPrompt}`

    const response = await chatCompletion(
        [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: chunk.content.slice(0, 5000) }
        ],
        { maxTokens: 500, temperature: 0.3 }
    )

    // 解析 JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
            chapter: chapterNumber,
            beat: parsed.beat || `第${chapterNumber}章`,
            function: parsed.function || '过渡',
            mood: parsed.mood || '平稳',
            wordCount: parsed.wordCount || chunk.content.length
        }
    }

    throw new Error('无法解析切片分析结果')
}

/**
 * 宏观归约
 */
async function reduceMacro(beats: BeatItem[]): Promise<MacroAnalysis> {
    // 构建节拍列表
    const beatList = beats.map((b, i) =>
        `第${i + 1}章：${b.beat} (${b.function}, ${b.mood}, ${b.wordCount}字)`
    ).join('\n')

    const prompt = MACRO_REDUCE_PROMPT.replace('{BEAT_LIST}', beatList)

    const response = await chatCompletion(
        [
            { role: 'system', content: '你是一个专业的小说结构分析师。' },
            { role: 'user', content: prompt }
        ],
        { maxTokens: 1000, temperature: 0.3 }
    )

    // 解析 JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
            corePlot: parsed.corePlot || '未识别',
            keyTurns: parsed.keyTurns || [],
            overallPacing: parsed.overallPacing || '未知'
        }
    }

    // 返回默认值
    return {
        corePlot: '核心情节分析失败',
        keyTurns: [],
        overallPacing: '未知'
    }
}

// ========== 辅助函数 ==========

/**
 * 提取关键转折点
 */
export function extractKeyTurns(beats: BeatItem[]): BeatItem[] {
    return beats.filter(b =>
        b.function === '转折' ||
        b.function === '高潮' ||
        b.mood === '震惊' ||
        b.mood === '爽'
    )
}

/**
 * 计算情绪曲线
 */
export function calculateMoodCurve(beats: BeatItem[]): Array<{ chapter: number; intensity: number }> {
    const moodIntensityMap: Record<string, number> = {
        '压抑': 3,
        '期待': 5,
        '震惊': 7,
        '爽': 9,
        '燃': 10,
        '感动': 8,
        '好奇': 4,
        '愤怒': 8,
        '解气': 9,
        '意外': 6,
        '悬念': 5,
        '平稳': 5
    }

    return beats.map(b => ({
        chapter: b.chapter,
        intensity: moodIntensityMap[b.mood] || 5
    }))
}

/**
 * 生成结构摘要
 */
export function generateStructureSummary(analysis: StructureAnalysis): string {
    const { beats, macro, totalChapters, totalWords } = analysis

    const summary = `
【结构分析摘要】
- 总章节数：${totalChapters}
- 总字数：${(totalWords / 10000).toFixed(1)} 万字
- 核心情节：${macro.corePlot}
- 整体节奏：${macro.overallPacing}
- 关键转折：${macro.keyTurns.join('、')}

【章节分布】
${beats.slice(0, 5).map(b => `第${b.chapter}章：${b.beat} (${b.mood})`).join('\n')}
${beats.length > 5 ? `...还有 ${beats.length - 5} 章` : ''}
    `.trim()

    return summary
}

// ========== 导出 ==========

export default {
    analyzeText,
    extractKeyTurns,
    calculateMoodCurve,
    generateStructureSummary
}
