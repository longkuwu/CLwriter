/**
 * Files API - 统一文件管理
 * 
 * 提供 CRUD 操作用于管理项目资源文件
 * 用于左侧资源树显示和编辑
 */

import { getDatabase } from '../db'
import { files } from '../db/schema'
import { eq, and, asc } from 'drizzle-orm'

// 文件类型
export type FileType = 'setting' | 'chapter' | 'outline' | 'worldview' | 'character' | 'folder'

// 文件数据类型
export interface FileData {
    id: string
    novelId: string | null // Deprecated
    projectId: string | null
    title: string
    type: FileType
    parentId: string | null
    content: string
    order: number
    summary: string | null
    metadata: Record<string, unknown> | null
    createdAt: Date
    updatedAt: Date
}

// 创建文件输入
export interface CreateFileInput {
    novelId?: string // Deprecated
    projectId: string
    title: string
    type: FileType
    parentId?: string
    content?: string
    order?: number
    summary?: string
    metadata?: Record<string, unknown>
}

// 树节点类型 (用于资源树显示)
export interface FileTreeNode {
    id: string
    title: string
    type: FileType
    children?: FileTreeNode[]
    content?: string
    metadata?: Record<string, unknown>
}

/**
 * 创建新文件
 */
export async function createFile(input: CreateFileInput): Promise<FileData | null> {
    try {
        const db = await getDatabase()

        const result = await db.insert(files).values({
            novelId: input.novelId || 'default-novel',
            projectId: input.projectId,
            title: input.title,
            type: input.type,
            parentId: input.parentId || null,
            content: input.content || '',
            order: input.order || 0,
            summary: input.summary || null,
            metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        }).returning()

        if (result.length === 0) return null

        const row = result[0]
        console.log(`[Files] 创建文件成功: ${row.title} (Project: ${input.projectId})`)

        return parseFileRow(row)
    } catch (error) {
        console.error('[Files] 创建文件失败:', error)
        return null
    }
}

/**
 * 获取所有文件 (按类型)
 */
export async function getFilesByType(projectId: string, type: FileType): Promise<FileData[]> {
    try {
        const db = await getDatabase()

        const results = await db.select()
            .from(files)
            .where(and(
                eq(files.projectId, projectId),
                eq(files.type, type)
            ))
            .orderBy(asc(files.order))

        return results.map(parseFileRow)
    } catch (error) {
        console.error('[Files] 获取文件失败:', error)
        return []
    }
}

/**
 * 获取所有文件 (用于资源树)
 */
export async function getAllFiles(projectId: string): Promise<FileData[]> {
    try {
        const db = await getDatabase()

        // 获取特定项目的文件
        const results = await db.select()
            .from(files)
            .where(eq(files.projectId, projectId))
            .orderBy(asc(files.order))

        return results.map(parseFileRow)
    } catch (error) {
        console.error('[Files] 获取所有文件失败:', error)
        return []
    }
}

/**
 * 根据 ID 获取文件
 */
export async function getFileById(id: string): Promise<FileData | null> {
    try {
        const db = await getDatabase()

        const results = await db.select()
            .from(files)
            .where(eq(files.id, id))
            .limit(1)

        if (results.length === 0) return null
        return parseFileRow(results[0])
    } catch (error) {
        console.error('[Files] 获取文件失败:', error)
        return null
    }
}

/**
 * 更新文件内容
 */
export async function updateFile(id: string, updates: Partial<CreateFileInput>): Promise<boolean> {
    try {
        const db = await getDatabase()

        const updateData: Record<string, unknown> = {
            updatedAt: new Date(),
        }

        if (updates.title !== undefined) updateData.title = updates.title
        if (updates.content !== undefined) updateData.content = updates.content
        if (updates.order !== undefined) updateData.order = updates.order
        if (updates.summary !== undefined) updateData.summary = updates.summary
        if (updates.metadata !== undefined) updateData.metadata = JSON.stringify(updates.metadata)
        if (updates.parentId !== undefined) updateData.parentId = updates.parentId
        if (updates.projectId !== undefined) updateData.projectId = updates.projectId

        await db.update(files)
            .set(updateData)
            .where(eq(files.id, id))

        console.log(`[Files] 更新文件成功: ${id}`)
        return true
    } catch (error) {
        console.error('[Files] 更新文件失败:', error)
        return false
    }
}

/**
 * 删除文件
 */
export async function deleteFile(id: string): Promise<boolean> {
    try {
        const db = await getDatabase()

        await db.delete(files)
            .where(eq(files.id, id))

        console.log(`[Files] 删除文件成功: ${id}`)
        return true
    } catch (error) {
        console.error('[Files] 删除文件失败:', error)
        return false
    }
}

/**
 * 构建文件树结构
 */
export function buildFileTree(files: FileData[]): FileTreeNode[] {
    const nodeMap = new Map<string, FileTreeNode>()
    const roots: FileTreeNode[] = []

    // 创建所有节点
    files.forEach(file => {
        nodeMap.set(file.id, {
            id: file.id,
            title: file.title,
            type: file.type as FileType,
            content: file.content,
            metadata: file.metadata || undefined,
            children: [],
        })
    })

    // 构建树结构
    files.forEach(file => {
        const node = nodeMap.get(file.id)!
        if (file.parentId && nodeMap.has(file.parentId)) {
            nodeMap.get(file.parentId)!.children!.push(node)
        } else {
            roots.push(node)
        }
    })

    return roots
}

/**
 * 批量保存创世生成的内容
 */
export async function saveGenesisResults(
    projectId: string,
    worldLayers: Array<{ name: string; content: string }>,
    outline: Array<{ chapter: number; title: string; summary: string }>,
    firstChapter: { title: string; content: string }
): Promise<boolean> {
    try {
        console.log('[Files] 开始保存创世结果...')
        const novelId = 'default-novel'

        // 保存世界观
        for (let i = 0; i < worldLayers.length; i++) {
            const layer = worldLayers[i]
            await createFile({
                projectId,
                novelId,
                title: layer.name,
                type: 'worldview',
                content: layer.content,
                order: i,
                metadata: { layerIndex: i },
            })
        }

        // 保存大纲
        await createFile({
            projectId,
            novelId,
            title: '大纲',
            type: 'outline',
            content: outline.map(o => `## 第${o.chapter}章 ${o.title}\n\n${o.summary}`).join('\n\n---\n\n'),
            order: 0,
            metadata: { chapters: outline.length },
        })

        // 保存第一章
        await createFile({
            projectId,
            novelId,
            title: `第一章 ${firstChapter.title}`,
            type: 'chapter',
            content: firstChapter.content,
            order: 1,
            metadata: { chapterNumber: 1 },
        })

        console.log('[Files] 创世结果保存完成')
        return true
    } catch (error) {
        console.error('[Files] 保存创世结果失败:', error)
        return false
    }
}

/**
 * 创建下一章节
 * 查找当前项目最大章节序号，创建新章节
 */
export async function createNextChapter(projectId: string): Promise<FileData | null> {
    try {
        const db = await getDatabase()

        // 1. 查询当前项目所有章节，找最大 order
        const chapters = await db.select()
            .from(files)
            .where(and(
                eq(files.projectId, projectId),
                eq(files.type, 'chapter')
            ))
            .orderBy(asc(files.order))

        // 2. 计算新序号
        let maxOrder = 0
        for (const ch of chapters) {
            if (ch.order && ch.order > maxOrder) {
                maxOrder = ch.order
            }
        }
        const newOrder = maxOrder + 1

        // 3. 生成章节标题
        const chapterNumber = chapters.length + 1
        const title = `第${chapterNumber}章：(未命名)`

        // 4. 创建新章节
        const result = await db.insert(files).values({
            novelId: 'default-novel',
            projectId: projectId,
            title: title,
            type: 'chapter',
            content: '',  // 空内容，会触发章节启动器
            order: newOrder,
            summary: null,
            metadata: JSON.stringify({ chapterNumber }),
        }).returning()

        if (result.length === 0) {
            console.error('[Files] 创建章节失败：返回为空')
            return null
        }

        const row = result[0]
        console.log(`[Files] 创建新章节成功: ${title} (Order: ${newOrder})`)

        return parseFileRow(row)

    } catch (error) {
        console.error('[Files] 创建章节失败:', error)
        return null
    }
}

// 辅助函数：解析数据库行
function parseFileRow(row: typeof files.$inferSelect): FileData {
    return {
        id: row.id,
        novelId: row.novelId,
        projectId: row.projectId,
        title: row.title,
        type: row.type as FileType,
        parentId: row.parentId || null,
        content: row.content || '',
        order: row.order || 0,
        summary: row.summary || null,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    }
}

