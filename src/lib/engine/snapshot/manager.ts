/**
 * 快照管理器 - 数据库读写
 */

import { getDatabase } from '../../db'
import { factSnapshots } from '../../db/schema'
import { eq, and, desc, lte } from 'drizzle-orm'
import type { FactSnapshot } from './types'
import { emptySnapshot } from './types'

/**
 * 读取项目最新的事实快照
 */
export async function getLatestSnapshot(projectId: string): Promise<FactSnapshot | null> {
    try {
        const db = await getDatabase()
        const rows = await db.select()
            .from(factSnapshots)
            .where(eq(factSnapshots.projectId, projectId))
            .orderBy(desc(factSnapshots.chapterOrder))
            .limit(1)

        if (rows.length === 0) return null
        return rowToSnapshot(rows[0])
    } catch (e) {
        console.error('[SnapshotManager] 读取最新快照失败:', e)
        return null
    }
}

/**
 * 读取截止指定章节的快照
 */
export async function getSnapshotAt(
    projectId: string,
    chapterOrder: number
): Promise<FactSnapshot | null> {
    try {
        const db = await getDatabase()
        const rows = await db.select()
            .from(factSnapshots)
            .where(and(
                eq(factSnapshots.projectId, projectId),
                lte(factSnapshots.chapterOrder, chapterOrder)
            ))
            .orderBy(desc(factSnapshots.chapterOrder))
            .limit(1)

        if (rows.length === 0) return null
        return rowToSnapshot(rows[0])
    } catch (e) {
        console.error('[SnapshotManager] 读取章节快照失败:', e)
        return null
    }
}

/**
 * 保存快照
 */
export async function saveSnapshot(
    projectId: string,
    snapshot: FactSnapshot
): Promise<boolean> {
    try {
        const db = await getDatabase()

        // 先尝试查找该章节是否已有快照
        const existing = await db.select()
            .from(factSnapshots)
            .where(and(
                eq(factSnapshots.projectId, projectId),
                eq(factSnapshots.chapterOrder, snapshot.chapterOrder)
            ))
            .limit(1)

        const data = {
            projectId,
            chapterId: snapshot.chapterId || null,
            chapterOrder: snapshot.chapterOrder,
            characterStates: snapshot.characterStates,
            characterLocations: snapshot.characterLocations,
            characterAppearances: snapshot.characterAppearances,
            conflictStates: snapshot.conflictStates,
            foreshadowStates: snapshot.foreshadowStates,
            plotNodes: snapshot.plotNodes,
            locationStates: snapshot.locationStates,
            factionStates: snapshot.factionStates,
            timeline: snapshot.timeline,
            itemStates: snapshot.itemStates,
            worldConstraints: snapshot.worldConstraints,
            locationFeatures: snapshot.locationFeatures,
            secretStates: snapshot.secretStates,
            oathStates: snapshot.oathStates,
            deadlineStates: snapshot.deadlineStates,
            updatedAt: new Date()
        }

        if (existing.length > 0) {
            // 更新
            await db.update(factSnapshots)
                .set(data)
                .where(eq(factSnapshots.id, existing[0].id))
        } else {
            // 插入
            await db.insert(factSnapshots).values(data)
        }

        return true
    } catch (e) {
        console.error('[SnapshotManager] 保存快照失败:', e)
        return false
    }
}

/**
 * 行 -> Snapshot 对象
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSnapshot(row: any): FactSnapshot {
    return {
        chapterId: row.chapterId || '',
        chapterOrder: row.chapterOrder,
        characterStates: row.characterStates || [],
        characterLocations: row.characterLocations || [],
        characterAppearances: row.characterAppearances || [],
        conflictStates: row.conflictStates || [],
        foreshadowStates: row.foreshadowStates || [],
        plotNodes: row.plotNodes || [],
        locationStates: row.locationStates || [],
        factionStates: row.factionStates || [],
        timeline: row.timeline || [],
        itemStates: row.itemStates || [],
        worldConstraints: row.worldConstraints || [],
        locationFeatures: row.locationFeatures || [],
        secretStates: row.secretStates || [],
        oathStates: row.oathStates || [],
        deadlineStates: row.deadlineStates || [],
        updatedAt: new Date(row.updatedAt)
    }
}

/**
 * 获取或创建初始快照
 */
export async function ensureSnapshot(projectId: string): Promise<FactSnapshot> {
    const existing = await getLatestSnapshot(projectId)
    if (existing) return existing
    return emptySnapshot('', 0)
}
