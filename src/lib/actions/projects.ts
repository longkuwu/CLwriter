/**
 * Projects API - 多项目管理
 * 
 * 提供 CRUD 操作用于管理书架项目
 */

import { getDatabase } from '../db'
import { projects } from '../db/schema'
import { eq, desc } from 'drizzle-orm'

// 引擎类型
export type EngineType = 'epic' | 'viral'

// 项目数据类型
export interface ProjectData {
    id: string
    title: string
    coverUrl: string | null
    engineType: EngineType | null
    createdAt: Date
    updatedAt: Date
}

/**
 * 创建新项目
 * 
 * @param title - 项目名称
 * @param engineType - 引擎类型 ('epic' | 'viral')
 */
export async function createProject(
    title: string,
    engineType: EngineType = 'epic'
): Promise<ProjectData | null> {
    try {
        const db = await getDatabase()

        const result = await db.insert(projects).values({
            title,
            engineType,
        }).returning()

        if (result.length === 0) return null

        const row = result[0]
        console.log(`[Projects] 创建项目成功: ${row.title} (${engineType})`)

        return {
            ...row,
            engineType: row.engineType as EngineType | null
        }
    } catch (error) {
        console.error('[Projects] 创建项目失败:', error)
        return null
    }
}

/**
 * 获取所有项目 (按时间倒序)
 */
export async function getAllProjects(): Promise<ProjectData[]> {
    try {
        const db = await getDatabase()

        const results = await db.select()
            .from(projects)
            .orderBy(desc(projects.updatedAt))

        return results.map(row => ({
            ...row,
            engineType: (row.engineType as EngineType) || 'epic'
        }))
    } catch (error) {
        console.error('[Projects] 获取所有项目失败:', error)
        return []
    }
}

/**
 * 根据 ID 获取项目
 */
export async function getProjectById(id: string): Promise<ProjectData | null> {
    try {
        const db = await getDatabase()

        const results = await db.select()
            .from(projects)
            .where(eq(projects.id, id))
            .limit(1)

        if (results.length === 0) return null

        const row = results[0]
        return {
            ...row,
            engineType: (row.engineType as EngineType) || 'epic'
        }
    } catch (error) {
        console.error('[Projects] 获取项目失败:', error)
        return null
    }
}

/**
 * 删除项目 (级联删除所有文件)
 */
export async function deleteProject(id: string): Promise<boolean> {
    try {
        const db = await getDatabase()

        await db.delete(projects)
            .where(eq(projects.id, id))

        console.log(`[Projects] 删除项目成功: ${id}`)
        return true
    } catch (error) {
        console.error('[Projects] 删除项目失败:', error)
        return false
    }
}
