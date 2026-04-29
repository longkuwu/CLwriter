import { pgTable, text, timestamp, uuid, vector, integer, jsonb } from 'drizzle-orm/pg-core';

export const novels = pgTable('novels', {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    content: text('content').default(''),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const codex = pgTable('codex', {
    id: uuid('id').defaultRandom().primaryKey(),
    novelId: uuid('novel_id')
        .references(() => novels.id, { onDelete: 'cascade' })
        .notNull(),
    category: text('category').notNull(), // e.g., 'Character', 'Item', 'Location'
    content: text('content').notNull(),
    // Assuming 768 dimensions (common for models like mxbai-embed-large or similar local models)
    // Adjust dimension based on the actual model you plan to use.
    embedding: vector('embedding', { dimensions: 768 }),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 章节表 - 用于存储章节摘要实现滚动摘要机制
export const chapters = pgTable('chapters', {
    id: uuid('id').defaultRandom().primaryKey(),
    novelId: uuid('novel_id')
        .references(() => novels.id, { onDelete: 'cascade' })
        .notNull(),
    chapterNumber: integer('chapter_number').notNull(),
    title: text('title').notNull(),
    content: text('content').default(''),
    // 滚动摘要：100-200 字的技术性摘要（关键事件、物品变更、好感度变化）
    summary: text('summary').default(''),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 用户自定义风格表 - 存储用户创建的写作风格配置
export const userStyles = pgTable('user_styles', {
    id: uuid('id').defaultRandom().primaryKey(),
    // 风格名称，如"暗黑克苏鲁"、"甜宠日常"
    name: text('name').notNull(),
    // 核心写作指令，如"多用短句，环境描写要压抑"
    coreInstruction: text('core_instruction').notNull(),
    // Few-shot 范例：存储 3-5 个用户输入的范文片段
    // 格式: [{ "context": "场景描述", "example": "范文内容" }]
    fewShotExamples: jsonb('few_shot_examples').default([]),
    // 反向提示词：明确不要出现的内容，如"不要出现网络用语"
    negativePrompt: text('negative_prompt').default(''),
    // 分类标签，便于筛选
    category: text('category').default('自定义'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
