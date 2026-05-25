/**
 * Imitation Agent - 骨架重绘与批量创建引擎
 * 
 * 功能：
 * 1. 骨架重绘（Skeleton Remapping）
 * 2. 批量创建章节文件
 * 3. 自动连载生成
 */

import { chatCompletion } from '../tauri-api'
import { createFile, updateFile } from '../actions/files'
import type { BeatItem } from './deconstruct-agent'

// ========== 类型定义 ==========

/**
 * 重绘后的节拍
 */
export interface RemappedBeat {
    chapter: number
    originalBeat: string      // 原作节拍
    newBeat: string           // 新主题节拍
    function: string          // 结构功能
    mood: string              // 情绪
    targetWordCount: number   // 目标字数
}

/**
 * 连载状态
 */
export interface SerializationState {
    isRunning: boolean
    currentChapter: number
    totalChapters: number
    completedChapters: number
    errors: string[]
}

// ========== Prompt 模板 ==========

/**
 * 骨架重绘 Prompt
 */
const SKELETON_REMAP_PROMPT = `你是一个小说结构设计师。请根据原作的节奏骨架，重新设计一个新主题的故事骨架。

【原作骨架】
{ORIGINAL_BEATS}

【原作主题】
{ORIGINAL_THEME}

【新主题】
{NEW_THEME}

【任务要求】
1. 保持原作的节奏结构和情绪曲线
2. 将每个节拍重新映射到新主题
3. 保持结构功能不变（开篇/转折/高潮等）
4. 字数比例保持 {SCALE_RATIO}:1

【输出格式】
请严格输出 JSON 数组：
[
  {
    "chapter": 1,
    "originalBeat": "原作节拍",
    "newBeat": "新主题节拍",
    "function": "结构功能",
    "mood": "情绪",
    "targetWordCount": 目标字数
  },
  ...
]

直接输出 JSON，不要任何其他文字。`

/**
 * 章节生成 Prompt
 */
const CHAPTER_GENERATION_PROMPT = `你是一个专业的网络小说作家。请根据以下要求创作章节内容。

【章节信息】
- 章节号：第 {CHAPTER_NUMBER} 章
- 节拍：{BEAT}
- 结构功能：{FUNCTION}
- 目标情绪：{MOOD}
- 目标字数：{TARGET_WORD_COUNT} 字

【前文摘要】
{PREVIOUS_SUMMARY}

【风格指导】
{STYLE_GUIDE}

【创作要求】
1. 严格按照节拍和结构功能创作
2. 情绪走向符合目标情绪
3. 字数控制在目标字数的 ±20% 范围内
4. 直接输出正文，不要标题或前言
5. 保持与前文的连贯性

开始创作：`

// ========== 核心函数 ==========

/**
 * 骨架重绘
 * @param originalBeats 原作节拍列表
 * @param originalTheme 原作主题
 * @param newTheme 新主题
 * @param scaleRatio 缩放比例（默认 1.0）
 * @returns 重绘后的节拍列表
 */
export async function remapSkeleton(
    originalBeats: BeatItem[],
    originalTheme: string,
    newTheme: string,
    scaleRatio: number = 1.0
): Promise<RemappedBeat[]> {
    console.log(`[ImitationAgent] 开始骨架重绘，原作 ${originalBeats.length} 章 -> 新作`)

    // 构建原作骨架描述
    const originalBeatsText = originalBeats.map((b, i) =>
        `第${i + 1}章：${b.beat} (${b.function}, ${b.mood}, ${b.wordCount}字)`
    ).join('\n')

    // 替换 Prompt 模板
    const prompt = SKELETON_REMAP_PROMPT
        .replace('{ORIGINAL_BEATS}', originalBeatsText)
        .replace('{ORIGINAL_THEME}', originalTheme)
        .replace('{NEW_THEME}', newTheme)
        .replace('{SCALE_RATIO}', scaleRatio.toString())

    try {
        const response = await chatCompletion(
            [
                { role: 'system', content: '你是一个专业的小说结构设计师。' },
                { role: 'user', content: prompt }
            ],
            { maxTokens: 4000, temperature: 0.7 }
        )

        // 解析 JSON
        const jsonMatch = response.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
            const remapped = JSON.parse(jsonMatch[0]) as RemappedBeat[]
            console.log(`[ImitationAgent] 骨架重绘完成，共 ${remapped.length} 章`)
            return remapped
        }

        throw new Error('无法解析骨架重绘结果')

    } catch (error) {
        console.error('[ImitationAgent] 骨架重绘失败:', error)
        throw error
    }
}

/**
 * 批量创建章节文件
 * @param projectId 项目 ID
 * @param beats 重绘后的节拍列表
 * @returns 创建结果
 */
export async function batchCreateChapters(
    projectId: string,
    beats: RemappedBeat[]
): Promise<{
    success: boolean
    chapters: Array<{ fileId: string; chapterNumber: number; title: string }>
    errors: string[]
}> {
    console.log(`[ImitationAgent] 开始批量创建 ${beats.length} 个章节`)

    const chapters: Array<{ fileId: string; chapterNumber: number; title: string }> = []
    const errors: string[] = []

    for (const beat of beats) {
        try {
            const title = `第${beat.chapter}章：${beat.newBeat}`

            // 创建章节文件
            const fileResult = await createFile({
                projectId,
                title,
                type: 'chapter',
                content: `# ${title}\n\n【待生成】\n\n节拍：${beat.newBeat}\n功能：${beat.function}\n情绪：${beat.mood}\n目标字数：${beat.targetWordCount}`,
                order: beat.chapter,
                metadata: {
                    beat: beat.newBeat,
                    function: beat.function,
                    mood: beat.mood,
                    targetWordCount: beat.targetWordCount,
                    status: 'pending'
                }
            })

            if (!fileResult) {
                throw new Error('创建文件返回 null')
            }

            chapters.push({
                fileId: fileResult.id,
                chapterNumber: beat.chapter,
                title
            })

            console.log(`[ImitationAgent] 创建章节 ${beat.chapter}: ${title}`)

        } catch (error) {
            const errorMsg = `第${beat.chapter}章创建失败: ${error instanceof Error ? error.message : '未知错误'}`
            console.error(errorMsg)
            errors.push(errorMsg)
        }
    }

    return {
        success: errors.length === 0,
        chapters,
        errors
    }
}

/**
 * 自动连载生成
 * @param chapters 章节列表
 * @param beats 节拍列表
 * @param styleGuide 风格指导
 * @param onProgress 进度回调
 * @param onChapterComplete 单章完成回调
 */
export async function autoSerialize(
    chapters: Array<{ fileId: string; chapterNumber: number; title: string }>,
    beats: RemappedBeat[],
    styleGuide: string = '',
    onProgress?: (state: SerializationState) => void,
    onChapterComplete?: (chapterNumber: number, content: string) => void
): Promise<void> {
    console.log(`[ImitationAgent] 开始自动连载，共 ${chapters.length} 章`)

    const state: SerializationState = {
        isRunning: true,
        currentChapter: 1,
        totalChapters: chapters.length,
        completedChapters: 0,
        errors: []
    }

    let previousSummary = '这是故事的开始。'

    for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i]
        const beat = beats[i]

        state.currentChapter = chapter.chapterNumber
        onProgress?.(state)

        try {
            console.log(`[ImitationAgent] 生成第 ${chapter.chapterNumber} 章...`)

            // 生成章节内容
            const content = await generateChapter(
                beat,
                previousSummary,
                styleGuide
            )

            // 更新文件
            await updateFile(chapter.fileId, {
                content: `# ${chapter.title}\n\n${content}`,
                metadata: {
                    status: 'completed',
                    generatedAt: new Date().toISOString()
                }
            })

            // 生成本章摘要供下一章使用
            previousSummary = await generateChapterSummary(content)

            state.completedChapters++
            onProgress?.(state)
            onChapterComplete?.(chapter.chapterNumber, content)

            console.log(`[ImitationAgent] 第 ${chapter.chapterNumber} 章完成`)

        } catch (error) {
            const errorMsg = `第${chapter.chapterNumber}章生成失败: ${error instanceof Error ? error.message : '未知错误'}`
            console.error(errorMsg)
            state.errors.push(errorMsg)
        }
    }

    state.isRunning = false
    onProgress?.(state)

    console.log(`[ImitationAgent] 自动连载完成，成功 ${state.completedChapters}/${state.totalChapters} 章`)
}

/**
 * 生成单章内容
 */
async function generateChapter(
    beat: RemappedBeat,
    previousSummary: string,
    styleGuide: string
): Promise<string> {
    const prompt = CHAPTER_GENERATION_PROMPT
        .replace('{CHAPTER_NUMBER}', beat.chapter.toString())
        .replace('{BEAT}', beat.newBeat)
        .replace('{FUNCTION}', beat.function)
        .replace('{MOOD}', beat.mood)
        .replace('{TARGET_WORD_COUNT}', beat.targetWordCount.toString())
        .replace('{PREVIOUS_SUMMARY}', previousSummary)
        .replace('{STYLE_GUIDE}', styleGuide || '无特殊风格要求')

    const response = await chatCompletion(
        [
            { role: 'system', content: '你是一个专业的网络小说作家。' },
            { role: 'user', content: prompt }
        ],
        { maxTokens: Math.min(beat.targetWordCount * 2, 4000), temperature: 0.8 }
    )

    return response
}

/**
 * 生成章节摘要
 */
async function generateChapterSummary(content: string): Promise<string> {
    const prompt = `请用 100 字以内概括以下章节的核心内容：\n\n${content.slice(0, 2000)}`

    try {
        const summary = await chatCompletion(
            [
                { role: 'system', content: '你是一个文本摘要专家。' },
                { role: 'user', content: prompt }
            ],
            { maxTokens: 200, temperature: 0.3 }
        )
        return summary
    } catch {
        // 如果摘要失败，返回前 100 字
        return content.slice(0, 100) + '...'
    }
}

// ========== 辅助函数 ==========

/**
 * 计算缩放比例
 */
export function calculateScaleRatio(
    originalTotalWords: number,
    targetTotalWords: number
): number {
    return targetTotalWords / originalTotalWords
}

/**
 * 验证骨架完整性
 */
export function validateSkeleton(beats: RemappedBeat[]): {
    isValid: boolean
    errors: string[]
} {
    const errors: string[] = []

    // 检查章节连续性
    for (let i = 0; i < beats.length; i++) {
        if (beats[i].chapter !== i + 1) {
            errors.push(`章节号不连续：期望第${i + 1}章，实际第${beats[i].chapter}章`)
        }
    }

    // 检查必填字段
    beats.forEach((beat, i) => {
        if (!beat.newBeat) {
            errors.push(`第${i + 1}章缺少节拍描述`)
        }
        if (!beat.function) {
            errors.push(`第${i + 1}章缺少结构功能`)
        }
        if (beat.targetWordCount <= 0) {
            errors.push(`第${i + 1}章目标字数无效`)
        }
    })

    return {
        isValid: errors.length === 0,
        errors
    }
}

// ========== 导出 ==========

const imitationAgentExports = {
    remapSkeleton,
    batchCreateChapters,
    autoSerialize,
    calculateScaleRatio,
    validateSkeleton
}

export default imitationAgentExports
