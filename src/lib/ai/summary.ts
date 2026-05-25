/**
 * Summary 模块 - 滚动摘要系统
 * 
 * 用于生成章节摘要，维持宏观剧情连续性
 */

import { chatCompletion } from '../tauri-api'
import { getDatabase } from '../db'
import { chapters } from '../db/schema'
import { eq, desc } from 'drizzle-orm'

// 章节摘要结果
export interface ChapterSummaryResult {
    summary: string
    success: boolean
    error?: string
}

// 章节信息
export interface ChapterInfo {
    id: string
    chapterNumber: number
    title: string
    summary: string
}

// 摘要生成系统提示
const SUMMARY_SYSTEM_PROMPT = `你是一个专业的小说编辑。你的任务是为章节生成技术性摘要。

摘要要求：
1. 控制在 100-200 字
2. 必须包含：关键事件、物品变更、人物关系变化
3. 使用客观第三人称
4. 按时间顺序列出重要节点
5. 忽略描写细节，只保留剧情骨架

格式示例：
"主角林冲在酒馆与陆谦发生冲突，得知被设计陷害。随后遭遇伏击，受重伤(HP-30)。逃入雪山，获得【青钢剑】。遇到神秘老者，获得心法残卷。与老者约定三日后再见。"`

/**
 * 生成章节摘要
 * 
 * @param content - 整章内容
 * @returns 技术性摘要
 */
export async function generateChapterSummary(content: string): Promise<ChapterSummaryResult> {
    console.log('[Summary] 开始生成章节摘要...')

    if (!content || content.trim().length < 100) {
        return {
            summary: '（章节内容过短，无法生成摘要）',
            success: false,
            error: '章节内容过短'
        }
    }

    const userPrompt = `请为以下章节内容生成技术性摘要：

---
${content.slice(0, 8000)}  // 最多取前8000字
---

请直接输出摘要，不要有其他前缀。`

    try {
        const summary = await chatCompletion(
            [
                { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
            ],
            { maxTokens: 512, temperature: 0.3 }  // 低温度确保客观准确
        )

        console.log('[Summary] 摘要生成完成')
        return { summary: summary.trim(), success: true }

    } catch (error) {
        console.error('[Summary] 生成失败:', error)
        return {
            summary: '',
            success: false,
            error: error instanceof Error ? error.message : '未知错误'
        }
    }
}

/**
 * 保存章节及其摘要
 */
export async function saveChapterWithSummary(
    novelId: string,
    chapterNumber: number,
    title: string,
    content: string,
    summary?: string
): Promise<string | null> {
    try {
        const db = await getDatabase()

        // 如果没有提供摘要，自动生成
        let finalSummary = summary
        if (!finalSummary) {
            const result = await generateChapterSummary(content)
            finalSummary = result.success ? result.summary : ''
        }

        // 生成章节 ID
        const chapterId = `chapter-${novelId}-${chapterNumber}`

        const result = await db.insert(chapters).values({
            id: chapterId,  // 必须提供 ID
            novelId,
            chapterNumber,
            title,
            content,
            summary: finalSummary,
        }).returning({ id: chapters.id })

        console.log(`[Summary] 章节 ${chapterNumber} 已保存, ID: ${chapterId}`)
        return result[0]?.id || chapterId

    } catch (error) {
        console.error('[Summary] 保存章节失败:', error)
        return null
    }
}

/**
 * 更新章节摘要
 */
export async function updateChapterSummary(
    chapterId: string,
    content: string
): Promise<boolean> {
    try {
        const db = await getDatabase()
        const result = await generateChapterSummary(content)

        if (!result.success) return false

        await db.update(chapters)
            .set({ summary: result.summary, updatedAt: new Date() })
            .where(eq(chapters.id, chapterId))

        return true
    } catch (error) {
        console.error('[Summary] 更新摘要失败:', error)
        return false
    }
}

/**
 * 获取最近 N 章的摘要（用于 Prompt 注入）
 * 
 * @param novelId - 小说 ID
 * @param limit - 获取章节数（默认 5）
 * @returns 最近章节的摘要列表
 */
export async function getRecentChapterSummaries(
    novelId: string,
    limit: number = 5
): Promise<ChapterInfo[]> {
    try {
        const db = await getDatabase()

        const results = await db.select({
            id: chapters.id,
            chapterNumber: chapters.chapterNumber,
            title: chapters.title,
            summary: chapters.summary,
        })
            .from(chapters)
            .where(eq(chapters.novelId, novelId))
            .orderBy(desc(chapters.chapterNumber))
            .limit(limit)

        // 按章节号正序返回（从旧到新）
        type Row = { id: string; chapterNumber: number | null; title: string; summary: string | null }
        return (results as Row[]).reverse().map((r: Row): ChapterInfo => ({
            id: r.id,
            chapterNumber: r.chapterNumber || 0,
            title: r.title,
            summary: r.summary || ''
        }))

    } catch (error) {
        console.error('[Summary] 获取摘要失败:', error)
        return []
    }
}

/**
 * 构建故事历史 Prompt 片段
 * 
 * @param novelId - 小说 ID
 * @returns 用于注入 System Prompt 的历史摘要文本
 */
export async function buildStoryHistoryPrompt(novelId: string): Promise<string> {
    const summaries = await getRecentChapterSummaries(novelId, 5)

    if (summaries.length === 0) {
        return ''
    }

    const lines = summaries.map(s =>
        `【第${s.chapterNumber}章：${s.title}】${s.summary}`
    )

    return `[Story So Far - 最近章节摘要]
${lines.join('\n\n')}
`
}
