/**
 * Database Schema - Drizzle ORM 表定义
 * 
 * 使用 PGlite 作为本地 PostgreSQL 数据库
 * 统一文件存储 + 向量嵌入
 */

import { pgTable, text, integer, timestamp, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * 项目表 - 用于多书管理
 */
export const projects = pgTable('projects', {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    coverUrl: text('cover_url'),
    // 引擎类型：'epic' (宏大叙事) | 'viral' (流量爆款)
    engineType: text('engine_type').default('epic'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * 统一文件表 - 用于左侧资源树
 * 存储所有项目文件：设定、章节、大纲等
 */
export const files = pgTable('files', {
    // 主键
    id: uuid('id').defaultRandom().primaryKey(),

    // 所属小说 ID (旧) -> 迁移到 projectId
    novelId: text('novel_id').default('default-novel'),

    // 所属项目 ID (新)
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),

    // 文件标题
    title: text('title').notNull(),

    // 文件类型：'setting' (设定) | 'chapter' (章节) | 'outline' (大纲) | 'worldview' (世界观) | 'character' (人物)
    type: text('type').notNull(),

    // 父节点 ID (用于文件夹结构)
    parentId: uuid('parent_id'),

    // Markdown 内容
    content: text('content').default(''),

    // 排序用
    order: integer('order').default(0),

    // 给 AI 看的摘要 (用于 RAG)
    summary: text('summary'),

    // 元数据 (JSON 字符串，用于存储章节号、世界观层级等)
    metadata: text('metadata'),

    // 时间戳
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    // 按小说 ID 索引
    novelIdIdx: index('files_novel_id_idx').on(table.novelId),
    // 按项目 ID 索引
    projectIdIdx: index('files_project_id_idx').on(table.projectId),
    // 按类型索引
    typeIdx: index('files_type_idx').on(table.type),
    // 按父节点索引
    parentIdIdx: index('files_parent_id_idx').on(table.parentId),
}))

/**
 * 向量嵌入表 - 用于 RAG 语义搜索
 * 存储文件切片后的向量
 */
export const embeddings = pgTable('embeddings', {
    // 主键
    id: uuid('id').defaultRandom().primaryKey(),

    // 关联的文件 ID
    fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }),

    // 所属小说 ID (冗余，方便查询)
    novelId: text('novel_id').notNull().default('default-novel'),

    // 切片后的文本内容
    content: text('content').notNull(),

    // 内容哈希 (用于去重)
    contentHash: text('content_hash'),

    // 向量嵌入 (存储为 JSON 字符串，维度根据模型)
    // PGlite 的 vector 扩展可能不稳定，暂用 text 存 JSON
    embedding: text('embedding').notNull(),

    // 时间戳
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    // 按文件 ID 索引
    fileIdIdx: index('embeddings_file_id_idx').on(table.fileId),
    // 按小说 ID 索引
    novelIdIdx: index('embeddings_novel_id_idx').on(table.novelId),
}))

/**
 * 用户风格表 - 存储用户创建的写作风格配置
 */
export const userStyles = pgTable('user_styles', {
    id: uuid('id').defaultRandom().primaryKey(),
    // 风格名称
    name: text('name').notNull(),
    // 核心写作指令
    coreInstruction: text('core_instruction').notNull(),
    // Few-shot 范例 (JSON)
    fewShotExamples: text('few_shot_examples').default('[]'),
    // 反向提示词
    negativePrompt: text('negative_prompt').default(''),
    // 分类标签
    category: text('category').default('自定义'),
    // 时间戳
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
})

/**
 * Codex 表 - 记忆库核心 (for memory.ts)
 */
export const codex = pgTable('codex', {
    id: uuid('id').defaultRandom().primaryKey(),
    novelId: text('novel_id').notNull(),
    chapterId: text('chapter_id'),
    content: text('content').notNull(),
    contentHash: text('content_hash').notNull(),
    embedding: text('embedding').notNull(), // JSON string
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    novelIdIdx: index('codex_novel_id_idx').on(table.novelId),
    contentHashIdx: uniqueIndex('codex_content_hash_idx').on(table.novelId, table.contentHash),
}))

/**
 * Characters 表 (Legacy/Memory)
 */
export const characters = pgTable('characters', {
    id: uuid('id').defaultRandom().primaryKey(),
    novelId: text('novel_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    traits: text('traits'),
    embedding: text('embedding'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    novelIdIdx: index('characters_novel_id_idx').on(table.novelId),
}))

/**
 * World Settings 表 (Legacy/Memory)
 */
export const worldSettings = pgTable('world_settings', {
    id: uuid('id').defaultRandom().primaryKey(),
    novelId: text('novel_id').notNull(),
    category: text('category').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    embedding: text('embedding'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    novelIdIdx: index('world_settings_novel_id_idx').on(table.novelId),
    categoryIdx: index('world_settings_category_idx').on(table.category),
}))

/**
 * Chapters 表 - 章节记录 (legacy/summary system)
 */
export const chapters = pgTable('chapters', {
    id: text('id').primaryKey(),
    novelId: text('novel_id').notNull(),
    chapterNumber: integer('chapter_number'),
    title: text('title').notNull(),
    content: text('content'),
    summary: text('summary'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    novelIdIdx: index('chapters_novel_id_idx').on(table.novelId),
}))

/**
 * 滚动摘要表 - 用于防止 AI 遗忘前文
 * 存储章节摘要快照，供 RAG 生成时注入
 */
export const summaries = pgTable('summaries', {
    id: uuid('id').defaultRandom().primaryKey(),
    // 关联书籍
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    // 关联具体章节（文件）
    chapterId: uuid('chapter_id').references(() => files.id, { onDelete: 'cascade' }),
    // 200字的压缩摘要
    content: text('content').notNull(),
    // 覆盖的起始章节序号
    startOrder: integer('start_order'),
    // 覆盖的结束章节序号
    endOrder: integer('end_order'),
    // 时间戳
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    projectIdIdx: index('summaries_project_id_idx').on(table.projectId),
    chapterIdIdx: index('summaries_chapter_id_idx').on(table.chapterId),
}))

// 类型导出
export type FileRecord = typeof files.$inferSelect
export type NewFileRecord = typeof files.$inferInsert
export type EmbeddingRecord = typeof embeddings.$inferSelect
export type NewEmbeddingRecord = typeof embeddings.$inferInsert
export type UserStyleRecord = typeof userStyles.$inferSelect
export type NewUserStyleRecord = typeof userStyles.$inferInsert
export type ProjectRecord = typeof projects.$inferSelect
export type NewProjectRecord = typeof projects.$inferInsert
export type CodexRecord = typeof codex.$inferSelect
export type CharacterRecord = typeof characters.$inferSelect
export type WorldSettingRecord = typeof worldSettings.$inferSelect
export type SummaryRecord = typeof summaries.$inferSelect
export type NewSummaryRecord = typeof summaries.$inferInsert

