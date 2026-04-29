/**
 * PGlite 数据库初始化
 * 
 * 使用 PGlite 作为本地 PostgreSQL 数据库
 * 数据存储在 IndexedDB 中，完全本地运行
 * 
 * 重要：PGlite 的 query() 方法只支持单条 SQL 语句
 * 每个 CREATE TABLE / CREATE INDEX 必须单独调用
 */

// 只导入类型（不会在运行时执行）
import type { PGlite } from '@electric-sql/pglite'

// Schema 是纯类型定义，可以安全导入
import * as schema from './schema'

// 单例模式
let pgliteInstance: PGlite | null = null
let dbInstance: any = null
let isInitialized = false
let initPromise: Promise<any> | null = null

/**
 * 检查是否在浏览器环境
 */
function isBrowser() {
    return typeof window !== 'undefined'
}

/**
 * 获取数据库连接 (懒加载 + 全动态导入)
 */
export async function getDatabase() {
    // 服务端渲染时，返回 null
    if (!isBrowser()) {
        return null
    }

    // 避免重复初始化
    if (initPromise) {
        return initPromise
    }

    // 已初始化，直接返回
    if (dbInstance && isInitialized) {
        return dbInstance
    }

    // 开始初始化
    initPromise = (async () => {
        try {
            // 动态导入 PGlite (只在浏览器端)
            const pgliteModule = await import('@electric-sql/pglite')
            const PGlite = pgliteModule.PGlite

            // 动态导入 drizzle (只在浏览器端)
            const drizzleModule = await import('drizzle-orm/pglite')
            const drizzle = drizzleModule.drizzle

            if (!pgliteInstance) {
                console.log('[DB] 初始化 PGlite...')
                pgliteInstance = new PGlite('idb://ip-architect-db')
                await pgliteInstance.waitReady
            }

            if (!dbInstance) {
                dbInstance = drizzle(pgliteInstance, { schema })
            }

            if (!isInitialized) {
                await initializeSchema()
                isInitialized = true
            }

            return dbInstance
        } catch (error) {
            console.error('[DB] 初始化失败:', error)
            initPromise = null
            throw error
        }
    })()

    return initPromise
}

/**
 * 执行单条 SQL (封装错误处理)
 */
async function execSQL(sql: string) {
    if (!pgliteInstance) return
    try {
        await pgliteInstance.query(sql)
    } catch (error: any) {
        // 忽略 "already exists" 错误
        if (error?.message?.includes('already exists')) {
            return
        }
        throw error
    }
}

/**
 * 初始化数据库结构 (Raw SQL)
 * 重要：每条 SQL 语句必须单独执行！
 */
async function initializeSchema() {
    if (!pgliteInstance) return

    try {
        console.log('[DB] 正在检查数据库结构...')

        // ========== Projects 表 ==========
        await execSQL(`
            CREATE TABLE IF NOT EXISTS projects (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title TEXT NOT NULL,
                cover_url TEXT,
                engine_type TEXT DEFAULT 'epic',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `)

        // ========== Novels 表 (Legacy) ==========
        await execSQL(`
            CREATE TABLE IF NOT EXISTS novels (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `)

        // 插入默认小说
        await execSQL(`
            INSERT INTO novels (id, title)
            VALUES ('default-novel', '默认小说')
            ON CONFLICT (id) DO NOTHING
        `)

        // ========== Files 表 ==========
        await execSQL(`
            CREATE TABLE IF NOT EXISTS files (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                novel_id TEXT DEFAULT 'default-novel',
                project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                type TEXT NOT NULL,
                parent_id UUID,
                content TEXT DEFAULT '',
                "order" INTEGER DEFAULT 0,
                summary TEXT,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `)

        // Files 索引 (每个单独执行)
        await execSQL(`CREATE INDEX IF NOT EXISTS files_project_id_idx ON files(project_id)`)
        await execSQL(`CREATE INDEX IF NOT EXISTS files_novel_id_idx ON files(novel_id)`)
        await execSQL(`CREATE INDEX IF NOT EXISTS files_type_idx ON files(type)`)

        // ========== User Styles 表 ==========
        await execSQL(`
            CREATE TABLE IF NOT EXISTS user_styles (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL,
                category TEXT DEFAULT '自定义',
                core_instruction TEXT NOT NULL,
                few_shot_examples TEXT DEFAULT '[]',
                negative_prompt TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `)

        // ========== Embeddings 表 ==========
        await execSQL(`
            CREATE TABLE IF NOT EXISTS embeddings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                file_id UUID REFERENCES files(id) ON DELETE CASCADE,
                novel_id TEXT DEFAULT 'default-novel',
                content TEXT NOT NULL,
                content_hash TEXT,
                embedding TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `)

        // ========== Codex 表 ==========
        await execSQL(`
            CREATE TABLE IF NOT EXISTS codex (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                novel_id TEXT NOT NULL,
                chapter_id TEXT,
                content TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                embedding TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `)
        await execSQL(`CREATE INDEX IF NOT EXISTS codex_novel_id_idx ON codex(novel_id)`)

        // ========== Chapters 表 ==========
        await execSQL(`
            CREATE TABLE IF NOT EXISTS chapters (
                id TEXT PRIMARY KEY,
                novel_id TEXT NOT NULL,
                chapter_number INTEGER,
                title TEXT NOT NULL,
                content TEXT,
                summary TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `)

        // ========== Summaries 表 (滚动摘要) ==========
        await execSQL(`
            CREATE TABLE IF NOT EXISTS summaries (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
                chapter_id UUID REFERENCES files(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                start_order INTEGER,
                end_order INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `)
        await execSQL(`CREATE INDEX IF NOT EXISTS summaries_project_id_idx ON summaries(project_id)`)
        await execSQL(`CREATE INDEX IF NOT EXISTS summaries_chapter_id_idx ON summaries(chapter_id)`)

        console.log('[DB] 数据库结构初始化完成 ✅')

    } catch (error) {
        console.error('[DB] 数据库初始化失败:', error)
        throw error
    }
}

/**
 * 获取底层 PGlite 实例 (用于原生 SQL 查询)
 */
export function getPGlite() {
    return pgliteInstance
}

/**
 * 重置数据库 (仅开发环境使用)
 */
export async function resetDatabase() {
    if (!isBrowser()) return

    if (pgliteInstance) {
        await pgliteInstance.close()
    }

    // 删除 IndexedDB
    const databases = await indexedDB.databases()
    for (const db of databases) {
        if (db.name?.includes('ip-architect')) {
            indexedDB.deleteDatabase(db.name)
            console.log(`[DB] 已删除数据库: ${db.name}`)
        }
    }

    // 重置单例
    pgliteInstance = null
    dbInstance = null
    isInitialized = false
    initPromise = null

    console.log('[DB] 数据库已重置')
}

// 导出 schema 供其他模块使用
export { schema }
