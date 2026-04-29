/**
 * Summaries Actions - 滚动摘要 CRUD 操作
 */

import { getDatabase } from '../db'
import { summaries } from '../db/schema'
import { eq, desc } from 'drizzle-orm'

export interface SummaryData {
    projectId: string
    chapterId?: string
    content: string
    startOrder?: number
    endOrder?: number
}

/**
 * 保存章节摘要
 */
export async function saveSummary(data: SummaryData): Promise<string | null> {
    try {
        const db = await getDatabase()

        const result = await db.insert(summaries).values({
            projectId: data.projectId,
            chapterId: data.chapterId || null,
            content: data.content,
            startOrder: data.startOrder,
            endOrder: data.endOrder,
        }).returning({ id: summaries.id })

        console.log(`[Summaries] 已保存摘要: ${result[0].id}`)
        return result[0].id

    } catch (error) {
        console.error('[Summaries] 保存失败:', error)
        return null
    }
}

/**
 * 获取项目最近 N 条摘要（用于 Prompt 注入）
 */
export async function getRecentSummariesByProject(
    projectId: string,
    limit: number = 5
): Promise<Array<{ id: string; content: string; startOrder: number | null; endOrder: number | null }>> {
    try {
        const db = await getDatabase()

        const results = await db.select({
            id: summaries.id,
            content: summaries.content,
            startOrder: summaries.startOrder,
            endOrder: summaries.endOrder,
        })
            .from(summaries)
            .where(eq(summaries.projectId, projectId))
            .orderBy(desc(summaries.createdAt))
            .limit(limit)

        // 返回时按顺序排列（从旧到新）
        return results.reverse()

    } catch (error) {
        console.error('[Summaries] 获取失败:', error)
        return []
    }
}

/**
 * 构建滚动摘要 Prompt 片段（用于 AI 生成时注入）
 */
export async function buildRollingSummaryPrompt(projectId: string): Promise<string> {
    const recentSummaries = await getRecentSummariesByProject(projectId, 5)

    if (recentSummaries.length === 0) {
        return ''
    }

    const lines = recentSummaries.map((s, i) => {
        const range = s.startOrder && s.endOrder
            ? `第${s.startOrder}-${s.endOrder}章`
            : `摘要 ${i + 1}`
        return `【${range}】${s.content}`
    })

    return `[📚 Story So Far - 前文重要情节回顾]
${lines.join('\n\n')}

---
`
}

/**
 * 删除指定章节的摘要
 */
export async function deleteSummaryByChapter(chapterId: string): Promise<boolean> {
    try {
        const db = await getDatabase()

        await db.delete(summaries)
            .where(eq(summaries.chapterId, chapterId))

        return true

    } catch (error) {
        console.error('[Summaries] 删除失败:', error)
        return false
    }
}
