/**
 * Imitation Agent - 等比仿写生成服务
 * 
 * 核心功能：
 * 1. 骨架重绘 - 将原作 Beat 翻译为新主题
 * 2. 批量章节创建 - 在文件系统中创建章节占位符
 * 3. 自动连载 - 逐章流式生成并保存
 */

import { chatCompletion, streamChatCompletion } from '../tauri-api'
import { createFile, updateFile, getFileById } from '../actions/files'
import type { BeatItem } from './deconstruct-agent'

// ========== 类型定义 ==========

// 仿写配置
export interface ImitationConfig {
    projectId: string           // 目标项目 ID
    originalBeats: BeatItem[]   // 原作骨架
    newTheme: string            // 新主题描述
    scaleCoefficient: number    // 字数系数 (0.5-2.0)
    styleGuide?: string         // 风格胶囊（可选）
}

// 重绘后的骨架
export interface RemappedBeat {
    chapter: number
    originalBeat: string        // 原作节拍
    newBeat: string             // 新主题节拍
    targetWordCount: number     // 目标字数
    summary: string             // 章节摘要/细纲
    status: 'pending' | 'generating' | 'done' | 'error'
}

// 批量创建结果
export interface BatchCreationResult {
    success: boolean
    chapters: Array<{
        fileId: string
        chapterNumber: number
        title: string
    }>
    totalTargetWords: number
}

// 自动连载状态
export interface SerializationState {
    currentChapter: number
    totalChapters: number
    completedChapters: number
    isRunning: boolean
    currentContent: string
}

// ========== Prompt 模板 ==========

// 骨架重绘 Prompt
const REMAP_SKELETON_PROMPT = `你是一位网络小说改编专家。请将原作的"节拍骨架"翻译为新主题。

【原作主题】
{ORIGINAL_THEME}

【新主题】
{NEW_THEME}

【需要翻译的节拍】
{BEATS_JSON}

【任务要求】
1. 保持相同的情绪节奏和结构功能
2. 将场景和元素替换为新主题的等价物
3. 保持每个节拍的字数比例

【输出格式】
输出 JSON 数组，每个元素包含：
[
  {
    "chapter": 章节号,
    "originalBeat": "原作节拍名",
    "newBeat": "新主题节拍名",
    "summary": "这一章的详细细纲（2-3句话描述发生什么）"
  }
]`

// 单章生成 Prompt
const CHAPTER_GENERATION_PROMPT = `你是一位网络小说写手。请根据以下细纲写一章。

【本章信息】
- 章节号：第 {CHAPTER_NUM} 章
- 标题：{CHAPTER_TITLE}
- 目标字数：约 {TARGET_WORDS} 字
- 情绪：{MOOD}

【章节细纲】
{SUMMARY}

【上一章结尾】
{PREVIOUS_ENDING}

【风格要求】
{STYLE_GUIDE}

【写作要求】
1. 严格按照细纲的剧情写
2. 字数控制在目标范围内（±20%）
3. 结尾设置悬念，吸引读者继续阅读
4. 使用当代网文的节奏和语言风格

开始写作：`

// ========== 核心函数 ==========

/**
 * 骨架重绘 - 将原作节拍翻译为新主题
 */
export async function remapSkeleton(
    originalBeats: BeatItem[],
    originalTheme: string,
    newTheme: string,
    scaleCoefficient: number = 1.0
): Promise<RemappedBeat[]> {
    console.log(`[ImitationAgent] 开始骨架重绘，${originalBeats.length} 个节拍`)

    // 分批处理（每批 10 个节拍，避免 token 限制）
    const batchSize = 10
    const allRemapped: RemappedBeat[] = []

    for (let i = 0; i < originalBeats.length; i += batchSize) {
        const batch = originalBeats.slice(i, i + batchSize)

        const beatsJson = JSON.stringify(batch.map(b => ({
            chapter: b.chapter,
            beat: b.beat,
            function: b.function,
            mood: b.mood,
            wordCount: b.wordCount
        })), null, 2)

        const prompt = REMAP_SKELETON_PROMPT
            .replace('{ORIGINAL_THEME}', originalTheme)
            .replace('{NEW_THEME}', newTheme)
            .replace('{BEATS_JSON}', beatsJson)

        try {
            const response = await chatCompletion(
                [
                    { role: 'system', content: '你是一位专业的网络小说改编专家。' },
                    { role: 'user', content: prompt }
                ],
                { maxTokens: 3000, temperature: 0.7 }
            )

            const jsonMatch = response.match(/\[[\s\S]*\]/)
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]) as Array<{
                    chapter: number
                    originalBeat: string
                    newBeat: string
                    summary: string
                }>

                // 合并字数信息
                for (const item of parsed) {
                    const original = batch.find(b => b.chapter === item.chapter)
                    allRemapped.push({
                        ...item,
                        targetWordCount: Math.round((original?.wordCount || 2000) * scaleCoefficient),
                        status: 'pending'
                    })
                }
            }
        } catch (error) {
            console.error(`[ImitationAgent] 批次 ${i / batchSize + 1} 重绘失败:`, error)
            // 失败时使用默认值
            for (const beat of batch) {
                allRemapped.push({
                    chapter: beat.chapter,
                    originalBeat: beat.beat,
                    newBeat: `第${beat.chapter}章`,
                    targetWordCount: Math.round(beat.wordCount * scaleCoefficient),
                    summary: beat.function,
                    status: 'pending'
                })
            }
        }
    }

    console.log(`[ImitationAgent] 骨架重绘完成，共 ${allRemapped.length} 章`)
    return allRemapped
}

/**
 * 批量创建章节文件
 */
export async function batchCreateChapters(
    projectId: string,
    remappedBeats: RemappedBeat[]
): Promise<BatchCreationResult> {
    console.log(`[ImitationAgent] 批量创建 ${remappedBeats.length} 个章节`)

    const chapters: Array<{ fileId: string; chapterNumber: number; title: string }> = []
    let totalTargetWords = 0

    for (const beat of remappedBeats) {
        try {
            // 创建章节文件
            const title = `第${beat.chapter}章 ${beat.newBeat}`
            const initialContent = `# ${title}\n\n<!-- 目标字数: ${beat.targetWordCount} 字 -->\n<!-- 细纲: ${beat.summary} -->\n\n（待生成）`

            const file = await createFile({
                projectId,
                type: 'chapter',
                title,
                content: initialContent,
                order: beat.chapter
            })

            if (file) {
                chapters.push({
                    fileId: file.id,
                    chapterNumber: beat.chapter,
                    title
                })
                totalTargetWords += beat.targetWordCount
            }
        } catch (error) {
            console.error(`[ImitationAgent] 创建第 ${beat.chapter} 章失败:`, error)
        }
    }

    console.log(`[ImitationAgent] 批量创建完成，共 ${chapters.length} 章，目标 ${totalTargetWords} 字`)

    return {
        success: chapters.length === remappedBeats.length,
        chapters,
        totalTargetWords
    }
}

/**
 * 自动连载 - 逐章生成
 */
export async function autoSerialize(
    chapters: Array<{ fileId: string; chapterNumber: number; title: string }>,
    remappedBeats: RemappedBeat[],
    styleGuide: string = '',
    onProgress: (state: SerializationState) => void,
    onChapterDone: (chapterNum: number, content: string) => void
): Promise<void> {
    console.log(`[ImitationAgent] 开始自动连载，共 ${chapters.length} 章`)

    let previousEnding = '（故事开始）'

    for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i]
        const beat = remappedBeats[i]

        // 更新进度
        onProgress({
            currentChapter: i + 1,
            totalChapters: chapters.length,
            completedChapters: i,
            isRunning: true,
            currentContent: ''
        })

        try {
            // 生成本章内容
            const content = await generateChapter(
                chapter.chapterNumber,
                chapter.title,
                beat.targetWordCount,
                beat.summary,
                beat.newBeat,
                previousEnding,
                styleGuide,
                (chunk) => {
                    onProgress({
                        currentChapter: i + 1,
                        totalChapters: chapters.length,
                        completedChapters: i,
                        isRunning: true,
                        currentContent: chunk
                    })
                }
            )

            // 保存章节
            await updateFile(chapter.fileId, {
                content: `# ${chapter.title}\n\n${content}`
            })

            // 提取结尾作为下一章的上文
            previousEnding = content.slice(-500)

            // 回调
            onChapterDone(chapter.chapterNumber, content)

        } catch (error) {
            console.error(`[ImitationAgent] 第 ${chapter.chapterNumber} 章生成失败:`, error)
            beat.status = 'error'
        }
    }

    // 完成
    onProgress({
        currentChapter: chapters.length,
        totalChapters: chapters.length,
        completedChapters: chapters.length,
        isRunning: false,
        currentContent: ''
    })

    console.log('[ImitationAgent] 自动连载完成！')
}

/**
 * 生成单章内容
 */
async function generateChapter(
    chapterNum: number,
    title: string,
    targetWords: number,
    summary: string,
    mood: string,
    previousEnding: string,
    styleGuide: string,
    onChunk: (fullContent: string) => void
): Promise<string> {
    const prompt = CHAPTER_GENERATION_PROMPT
        .replace('{CHAPTER_NUM}', String(chapterNum))
        .replace('{CHAPTER_TITLE}', title)
        .replace('{TARGET_WORDS}', String(targetWords))
        .replace('{MOOD}', mood)
        .replace('{SUMMARY}', summary)
        .replace('{PREVIOUS_ENDING}', previousEnding.slice(-300))
        .replace('{STYLE_GUIDE}', styleGuide || '网文风格，节奏紧凑，对话推动剧情')

    let fullContent = ''

    await streamChatCompletion(
        [
            { role: 'system', content: '你是一位专业的网络小说写手，擅长写节奏紧凑的爽文。' },
            { role: 'user', content: prompt }
        ],
        {
            onChunk: (chunk) => {
                fullContent += chunk
                onChunk(fullContent)
            },
            onDone: () => {
                console.log(`[ImitationAgent] 第 ${chapterNum} 章生成完成，${fullContent.length} 字`)
            },
            onError: (error) => {
                console.error(`[ImitationAgent] 第 ${chapterNum} 章生成错误:`, error)
            }
        },
        {
            maxTokens: Math.min(targetWords * 2, 8000),
            temperature: 0.8
        }
    )

    return fullContent
}

/**
 * 获取仿写进度统计
 */
export function getSerializationStats(
    remappedBeats: RemappedBeat[]
): { pending: number; done: number; error: number; totalWords: number; completedWords: number } {
    const stats = {
        pending: 0,
        done: 0,
        error: 0,
        totalWords: 0,
        completedWords: 0
    }

    for (const beat of remappedBeats) {
        stats.totalWords += beat.targetWordCount

        switch (beat.status) {
            case 'pending':
            case 'generating':
                stats.pending++
                break
            case 'done':
                stats.done++
                stats.completedWords += beat.targetWordCount
                break
            case 'error':
                stats.error++
                break
        }
    }

    return stats
}
