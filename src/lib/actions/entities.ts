/**
 * 实体管理 - Server Actions
 *
 * 角色 / 地点 / 势力 / 物品 / 伏笔 / 誓约 / 截止 / 秘密 / 冲突
 */

import { getDatabase } from '../db'
import { entities } from '../db/schema'
import { eq, and, desc } from 'drizzle-orm'
import type { EntityRecord, NewEntityRecord } from '../db/schema'

export type EntityType =
    | 'character'
    | 'location'
    | 'faction'
    | 'item'
    | 'foreshadow'
    | 'oath'
    | 'deadline'
    | 'secret'
    | 'conflict'
    | 'worldview'
    | 'plot_rule'

export interface EntityData {
    id: string
    projectId: string
    type: EntityType
    name: string
    archetype: string | null
    attributes: Record<string, unknown>
    rules: string[]
    status: 'active' | 'archived'
    createdAt: Date
    updatedAt: Date
}

export interface CreateEntityInput {
    projectId: string
    type: EntityType
    name: string
    archetype?: string
    attributes?: Record<string, unknown>
    rules?: string[]
}

/**
 * 创建实体
 */
export async function createEntity(input: CreateEntityInput): Promise<EntityData | null> {
    try {
        const db = await getDatabase()
        const data: NewEntityRecord = {
            projectId: input.projectId,
            type: input.type,
            name: input.name,
            archetype: input.archetype || null,
            attributes: input.attributes || {},
            rules: input.rules || [],
            status: 'active'
        }
        const result = await db.insert(entities).values(data).returning()
        if (result.length === 0) return null
        return rowToEntity(result[0])
    } catch (e) {
        console.error('[Entities] 创建失败:', e)
        return null
    }
}

/**
 * 列出某项目的所有实体
 */
export async function getEntitiesByProject(
    projectId: string,
    type?: EntityType
): Promise<EntityData[]> {
    try {
        const db = await getDatabase()
        let rows: EntityRecord[]
        if (type) {
            rows = await db.select()
                .from(entities)
                .where(and(
                    eq(entities.projectId, projectId),
                    eq(entities.type, type)
                ))
                .orderBy(desc(entities.updatedAt))
        } else {
            rows = await db.select()
                .from(entities)
                .where(eq(entities.projectId, projectId))
                .orderBy(desc(entities.updatedAt))
        }
        return rows.map(rowToEntity)
    } catch (e) {
        console.error('[Entities] 查询失败:', e)
        return []
    }
}

/**
 * 更新实体
 */
export async function updateEntity(
    id: string,
    updates: Partial<Omit<CreateEntityInput, 'projectId' | 'type'>>
): Promise<boolean> {
    try {
        const db = await getDatabase()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = { updatedAt: new Date() }
        if (updates.name !== undefined) data.name = updates.name
        if (updates.archetype !== undefined) data.archetype = updates.archetype
        if (updates.attributes !== undefined) data.attributes = updates.attributes
        if (updates.rules !== undefined) data.rules = updates.rules

        await db.update(entities).set(data).where(eq(entities.id, id))
        return true
    } catch (e) {
        console.error('[Entities] 更新失败:', e)
        return false
    }
}

/**
 * 归档实体 (软删除)
 */
export async function archiveEntity(id: string): Promise<boolean> {
    try {
        const db = await getDatabase()
        await db.update(entities)
            .set({ status: 'archived', updatedAt: new Date() })
            .where(eq(entities.id, id))
        return true
    } catch (e) {
        console.error('[Entities] 归档失败:', e)
        return false
    }
}

/**
 * 删除实体
 */
export async function deleteEntity(id: string): Promise<boolean> {
    try {
        const db = await getDatabase()
        await db.delete(entities).where(eq(entities.id, id))
        return true
    } catch (e) {
        console.error('[Entities] 删除失败:', e)
        return false
    }
}

function rowToEntity(row: EntityRecord): EntityData {
    return {
        id: row.id,
        projectId: row.projectId,
        type: row.type as EntityType,
        name: row.name,
        archetype: row.archetype,
        attributes: (row.attributes as Record<string, unknown>) || {},
        rules: (row.rules as string[]) || [],
        status: (row.status as 'active' | 'archived') || 'active',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    }
}
