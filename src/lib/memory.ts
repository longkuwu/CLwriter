/**
 * Memory 模块 - 自动存档与向量化
 * 
 * 实现章节内容的切片、向量化和存储
 */

import { getDatabase } from './db'
import { codex } from './db/schema'
import { generateEmbedding, generateEmbeddings } from './ai/embedding'
import { eq, and } from 'drizzle-orm'

/**
 * 简单哈希函数 (用于内容去重)
 * 使用 djb2 算法
 */
function hashString(str: string): string {
    let hash = 5381
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i)
        hash = hash & hash // 转为 32 位整数
    }
    return Math.abs(hash).toString(16)
}

/**
 * 将长文本切分为固定长度的片段
 * 
 * @param content - 原始内容
 * @param chunkSize - 每个片段的最大字符数
 * @param overlap - 片段之间的重叠字符数 (提高语义连贯性)
 * @returns 切分后的片段数组
 */
export function chunkContent(
    content: string,
    chunkSize: number = 500,
    overlap: number = 50
): string[] {
    const chunks: string[] = []
    let start = 0

    // 清理内容：移除多余空白
    const cleanContent = content.replace(/\s+/g, ' ').trim()

    if (cleanContent.length <= chunkSize) {
        return [cleanContent]
    }

    while (start < cleanContent.length) {
        let end = start + chunkSize

        // 尝试在句子边界处切分 (寻找句号、问号、感叹号)
        if (end < cleanContent.length) {
            const searchEnd = Math.min(end + 100, cleanContent.length)
            const segment = cleanContent.slice(end, searchEnd)
            const boundaryMatch = segment.match(/[。！？\.\!\?]/)

            if (boundaryMatch && boundaryMatch.index !== undefined) {
                end = end + boundaryMatch.index + 1
            }
        }

        const chunk = cleanContent.slice(start, end).trim()
        if (chunk.length > 0) {
            chunks.push(chunk)
        }

        // 下一个片段的起始位置 (考虑重叠)
        start = end - overlap
        if (start >= cleanContent.length) break
    }

    return chunks
}

/**
 * 保存章节内容到记忆库
 * 
 * 核心流程：
 * 1. 切片 (Chunking) - 按 500 字切分
 * 2. 向量化 - 调用 OpenAI Embedding API
 * 3. 存储 - 写入 PGlite 数据库
 * 4. 去重 - 通过 content hash 避免重复
 * 
 * @param novelId - 小说唯一标识
 * @param content - 章节全文内容
 * @param chapterId - 可选的章节标识
 * @returns 成功存储的片段数量
 */
export async function saveChapterMemory(
    novelId: string,
    content: string,
    chapterId?: string
): Promise<{ saved: number; skipped: number }> {
    const db = await getDatabase()

    // 1. 切片
    const chunks = chunkContent(content, 500, 50)
    console.log(`[Memory] 切片完成，共 ${chunks.length} 个片段`)

    let saved = 0
    let skipped = 0

    // 2. 处理每个片段
    for (const chunk of chunks) {
        const contentHash = hashString(chunk)

        // 3. 去重检查：查询是否已存在相同内容
        const existing = await db
            .select({ id: codex.id })
            .from(codex)
            .where(
                and(
                    eq(codex.novelId, novelId),
                    eq(codex.contentHash, contentHash)
                )
            )
            .limit(1)

        if (existing.length > 0) {
            skipped++
            continue
        }

        // 4. 向量化
        let embedding: number[]
        try {
            embedding = await generateEmbedding(chunk)
        } catch (error) {
            console.error(`[Memory] 向量化失败:`, error)
            throw error
        }

        // 5. 存储到数据库
        await db.insert(codex).values({
            novelId,
            chapterId,
            content: chunk,
            contentHash,
            embedding: JSON.stringify(embedding),
        })

        saved++
    }

    console.log(`[Memory] 存储完成，保存 ${saved} 条，跳过 ${skipped} 条重复`)
    return { saved, skipped }
}

/**
 * 批量保存章节内容 (优化版本)
 * 
 * 使用批量 embedding API 减少请求次数
 */
export async function saveChapterMemoryBatch(
    novelId: string,
    content: string,
    chapterId?: string
): Promise<{ saved: number; skipped: number }> {
    const db = await getDatabase()

    // 1. 切片
    const chunks = chunkContent(content, 500, 50)
    console.log(`[Memory] 切片完成，共 ${chunks.length} 个片段`)

    // 2. 计算所有 hash 并过滤重复
    const chunksWithHash = chunks.map(chunk => ({
        chunk,
        hash: hashString(chunk),
    }))

    // 3. 批量查询已存在的 hash
    const existingHashes = new Set<string>()
    for (const item of chunksWithHash) {
        const existing = await db
            .select({ hash: codex.contentHash })
            .from(codex)
            .where(
                and(
                    eq(codex.novelId, novelId),
                    eq(codex.contentHash, item.hash)
                )
            )
            .limit(1)

        if (existing.length > 0) {
            existingHashes.add(item.hash)
        }
    }

    // 4. 过滤出需要处理的新内容
    const newChunks = chunksWithHash.filter(item => !existingHashes.has(item.hash))
    const skipped = chunksWithHash.length - newChunks.length

    if (newChunks.length === 0) {
        console.log(`[Memory] 无新内容需要存储，跳过 ${skipped} 条重复`)
        return { saved: 0, skipped }
    }

    // 5. 批量向量化
    let embeddings: number[][]
    try {
        embeddings = await generateEmbeddings(newChunks.map(item => item.chunk))
    } catch (error) {
        console.error(`[Memory] 批量向量化失败:`, error)
        throw error
    }

    // 6. 批量存储
    const insertValues = newChunks.map((item, index) => ({
        novelId,
        chapterId,
        content: item.chunk,
        contentHash: item.hash,
        embedding: JSON.stringify(embeddings[index]),
    }))

    await db.insert(codex).values(insertValues)

    console.log(`[Memory] 存储完成，保存 ${newChunks.length} 条，跳过 ${skipped} 条重复`)
    return { saved: newChunks.length, skipped }
}

/**
 * 搜索相关记忆
 * 
 * @param novelId - 小说 ID
 * @param query - 查询文本
 * @param limit - 返回结果数量
 * @returns 相关记忆片段列表
 */
export async function searchMemory(
    novelId: string,
    query: string,
    limit: number = 5
): Promise<Array<{ content: string; similarity: number }>> {
    const db = await getDatabase()

    // 1. 生成查询向量
    const queryEmbedding = await generateEmbedding(query)

    // 2. 获取该小说的所有记忆
    const memories = await db
        .select({
            content: codex.content,
            embedding: codex.embedding,
        })
        .from(codex)
        .where(eq(codex.novelId, novelId))

    // 3. 计算相似度并排序
    const results = memories
        .map(memory => {
            const embedding = JSON.parse(memory.embedding) as number[]
            const similarity = cosineSimilarity(queryEmbedding, embedding)
            return { content: memory.content, similarity }
        })
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)

    return results
}

/**
 * 余弦相似度计算
 */
function cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    return denominator === 0 ? 0 : dotProduct / denominator
}
