/**
 * 数据中心打包器 - 主逻辑
 *
 * 为某一章节组装精准的数据包
 */

import { getDatabase } from '../../db'
import { entities, milestones as milestonesTable } from '../../db/schema'
import { eq, and } from 'drizzle-orm'
import { getLatestSnapshot } from '../snapshot/manager'
import type { ChapterPack } from './types'
import type { ChapterBlueprint } from '../gates/types'
import type { FactSnapshot } from '../snapshot/types'

/**
 * 为下一章打包数据
 *
 * @param projectId 项目 ID
 * @param chapterOrder 即将生成的章节序号
 * @param blueprint 章节蓝图 (可选)
 */
export async function packChapter(
    projectId: string,
    chapterOrder: number,
    blueprint?: ChapterBlueprint
): Promise<ChapterPack> {
    // 1. 读取上一章快照
    const factSnapshot = await getLatestSnapshot(projectId)

    // 2. 读取所有实体
    const allEntities = await getAllEntities(projectId)

    // 3. 筛选本章相关实体 (基于 blueprint 或全量降级)
    const relevantEntities = filterRelevantEntities(allEntities, blueprint, factSnapshot)

    // 4. 提取活跃伏笔 / 冲突 / 截止
    const activeForeshadows = factSnapshot
        ? factSnapshot.foreshadowStates.filter(f => f.status === 'setup' || f.status === 'reinforced')
        : []
    const activeConflicts = factSnapshot
        ? factSnapshot.conflictStates.filter(c => c.status === 'active' || c.status === 'escalated')
        : []
    const activeDeadlines = factSnapshot
        ? factSnapshot.deadlineStates.filter(d => d.status === 'active').map(d => `${d.deadlineId}: ${d.countdownTo}`)
        : []

    // 5. 历史里程碑
    const milestones = await getRecentMilestones(projectId, chapterOrder, 10)

    // 6. 状态偏离警告
    const driftWarnings = detectDrift(factSnapshot, chapterOrder)

    return {
        chapterOrder,
        blueprint: blueprint || null,
        fiveRules: {
            worldview: extractWorldviewRules(allEntities),
            characters: relevantEntities.filter(e => e.type === 'character'),
            factions: relevantEntities.filter(e => e.type === 'faction'),
            locations: relevantEntities.filter(e => e.type === 'location'),
            plotRules: extractPlotRules(allEntities)
        },
        outlineSlice: {
            bookTitle: '',
            currentVolume: '',
            volumeOutline: ''
        },
        chapterPlan: {
            title: blueprint?.title || `第 ${chapterOrder} 章`,
            synopsis: blueprint?.expectedScenes.join('; ') || '',
            sceneList: blueprint?.expectedScenes || []
        },
        templates: [],
        factSnapshot,
        summaryChain: [],     // TODO: 从 summaries 表读取
        prevTail: null,        // TODO: 从上一章正文取尾段
        milestones,
        vectorRecall: [],      // TODO: 向量召回
        prevVolumeFacts: null,
        driftWarnings,
        sceneGuide: '',
        activeForeshadows,
        activeConflicts,
        activeDeadlines
    }
}

// ========== 辅助函数 ==========

async function getAllEntities(projectId: string) {
    try {
        const db = await getDatabase()
        const rows = await db.select()
            .from(entities)
            .where(and(
                eq(entities.projectId, projectId),
                eq(entities.status, 'active')
            ))
        return rows
    } catch (e) {
        console.error('[Packager] 读取实体失败:', e)
        return []
    }
}

async function getRecentMilestones(projectId: string, beforeChapter: number, limit: number) {
    void beforeChapter
    try {
        const db = await getDatabase()
        const rows = await db.select()
            .from(milestonesTable)
            .where(eq(milestonesTable.projectId, projectId))
            .limit(limit)
        type Row = typeof milestonesTable.$inferSelect
        return (rows as Row[]).map((r: Row) => ({
            chapterOrder: r.chapterOrder,
            title: r.title,
            summary: r.summary
        }))
    } catch (e) {
        console.error('[Packager] 读取里程碑失败:', e)
        return []
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filterRelevantEntities(allEntities: any[], blueprint?: ChapterBlueprint, snapshot?: FactSnapshot | null) {
    if (!blueprint) {
        // 没蓝图: 返回最近活跃的角色/地点 (从 snapshot 中取)
        if (!snapshot) return allEntities.slice(0, 30)
        const activeChars = new Set(snapshot.characterStates.slice(-20).map(c => c.name))
        const activeLocs = new Set(snapshot.characterLocations.slice(-10).map(l => l.locationName))
        return allEntities.filter(e =>
            (e.type === 'character' && activeChars.has(e.name)) ||
            (e.type === 'location' && activeLocs.has(e.name)) ||
            e.type === 'faction'
        )
    }

    // 有蓝图: 精准筛选
    const targets = new Set([
        ...blueprint.targetCharacterIds,
        ...blueprint.targetLocationIds,
        ...blueprint.targetFactionIds
    ])
    return allEntities.filter(e => targets.has(e.name))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractWorldviewRules(allEntities: any[]): string[] {
    return allEntities
        .filter(e => e.type === 'worldview')
        .flatMap(e => (e.rules as string[] | null) || [])
        .slice(0, 20)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPlotRules(allEntities: any[]): string[] {
    return allEntities
        .filter(e => e.type === 'plot_rule')
        .flatMap(e => (e.rules as string[] | null) || [])
        .slice(0, 10)
}

function detectDrift(snapshot: FactSnapshot | null, chapter: number): string[] {
    if (!snapshot) return []
    void chapter
    const warnings: string[] = []

    // 检测过期伏笔
    const expired = snapshot.foreshadowStates.filter(f => f.status === 'expired')
    if (expired.length > 0) {
        warnings.push(`⚠️ ${expired.length} 个伏笔已过期: ${expired.slice(0, 3).map(f => f.foreshadowId).join(', ')}`)
    }

    // 检测过老的活跃伏笔
    const stale = snapshot.foreshadowStates.filter(f =>
        (f.status === 'setup' || f.status === 'reinforced') &&
        f.chaptersSinceSetup > 30
    )
    if (stale.length > 0) {
        warnings.push(`⏰ ${stale.length} 个伏笔超过 30 章未回收,考虑回收: ${stale.slice(0, 3).map(f => f.foreshadowId).join(', ')}`)
    }

    // 检测倒计时即将到期
    const ticking = snapshot.deadlineStates.filter(d => d.status === 'active')
    if (ticking.length > 0) {
        warnings.push(`⌛ ${ticking.length} 个倒计时进行中: ${ticking.slice(0, 3).map(d => d.name).join(', ')}`)
    }

    return warnings
}
