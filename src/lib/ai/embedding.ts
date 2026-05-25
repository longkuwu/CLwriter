/**
 * Embedding 向量生成工具
 * 
 * 使用 OpenAI text-embedding-3-small 模型生成文本向量
 * 完全本地运行，直接从客户端调用 API，不经过任何中间服务器
 */

import { getDatabase } from '../db'
import { embeddings } from '../db/schema'
import { eq } from 'drizzle-orm'

// LocalStorage 键 (与 SettingsDialog 保持一致)
const STORAGE_KEYS = {
    OPENAI_API_KEY: 'ip_architect_openai_api_key',
    DEEPSEEK_API_KEY: 'ip_architect_deepseek_api_key',
    SELECTED_PROVIDER: 'ip_architect_selected_provider',
}

// OpenAI Embedding API 端点
const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings'

// 模型配置
const EMBEDDING_MODEL = 'text-embedding-3-small' // 1536 维向量，性价比最高

// 文本切片配置
const CHUNK_SIZE = 500      // 每个切片大约 500 字
const CHUNK_OVERLAP = 50    // 切片重叠 50 字

/**
 * 从 localStorage 获取 API Key
 * @throws 如果未配置 API Key
 */
function getApiKey(): string {
    if (typeof window === 'undefined') {
        throw new Error('此函数只能在浏览器环境中运行')
    }

    // 优先使用 OpenAI Key（因为 embedding 必须用 OpenAI）
    const openaiKey = localStorage.getItem(STORAGE_KEYS.OPENAI_API_KEY)

    if (!openaiKey || openaiKey.trim() === '') {
        throw new Error('请先在设置中配置 OpenAI API Key（向量生成需要 OpenAI）')
    }

    return openaiKey.trim()
}

/**
 * 将文本切成多个片段
 */
function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
    if (!text || text.length === 0) return []

    const chunks: string[] = []
    let start = 0

    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length)
        const chunk = text.slice(start, end).trim()

        if (chunk.length > 0) {
            chunks.push(chunk)
        }

        start = end - overlap
        if (start >= text.length - overlap) break
    }

    return chunks
}

/**
 * 生成内容哈希（用于去重）
 */
function hashContent(content: string): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
    }
    return hash.toString(16)
}

/**
 * 生成文本的向量嵌入
 * 
 * @param text - 要生成向量的文本
 * @returns 1536 维的向量数组
 * @throws 如果 API 调用失败或未配置 Key
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const apiKey = getApiKey()

    if (!text || text.trim() === '') {
        throw new Error('输入文本不能为空')
    }

    const response = await fetch(OPENAI_EMBEDDING_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: text.trim(),
            encoding_format: 'float',
        }),
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData?.error?.message || `API 请求失败: ${response.status}`
        throw new Error(errorMessage)
    }

    const data = await response.json()

    if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error('API 返回数据格式异常')
    }

    const embedding: number[] = data.data[0].embedding

    if (embedding.length !== 1536) {
        console.warn(`向量维度异常: 期望 1536, 实际 ${embedding.length}`)
    }

    return embedding
}

/**
 * 批量生成向量嵌入
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    const apiKey = getApiKey()

    if (!texts || texts.length === 0) {
        throw new Error('输入文本数组不能为空')
    }

    const response = await fetch(OPENAI_EMBEDDING_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: texts.map(t => t.trim()),
            encoding_format: 'float',
        }),
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData?.error?.message || `API 请求失败: ${response.status}`
        throw new Error(errorMessage)
    }

    const data = await response.json()

    if (!data.data || !Array.isArray(data.data)) {
        throw new Error('API 返回数据格式异常')
    }

    return data.data
        .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
        .map((item: { embedding: number[] }) => item.embedding)
}

/**
 * 计算两个向量的余弦相似度
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length === 0 || b.length === 0) return 0
    if (a.length !== b.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    if (denominator === 0) return 0

    return dotProduct / denominator
}

// ========== 数据库操作 ==========

/**
 * 更新文件的向量嵌入
 * 
 * 1. 删除旧的向量
 * 2. 切片新内容
 * 3. 向量化每个切片
 * 4. 插入新向量
 */
export async function updateFileEmbedding(
    fileId: string,
    newContent: string,
    novelId: string = 'default-novel'
): Promise<boolean> {
    console.log(`[Embedding] 开始更新文件向量: ${fileId}`)

    try {
        const db = await getDatabase()

        // 1️⃣ 删除旧向量
        await db.delete(embeddings).where(eq(embeddings.fileId, fileId))
        console.log(`[Embedding] 已删除旧向量`)

        // 2️⃣ 切片新内容
        const chunks = chunkText(newContent)
        if (chunks.length === 0) {
            console.log(`[Embedding] 内容为空，跳过向量化`)
            return true
        }
        console.log(`[Embedding] 切片数量: ${chunks.length}`)

        // 3️⃣ 向量化并插入
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i]

            try {
                const embeddingVector = await generateEmbedding(chunk)

                await db.insert(embeddings).values({
                    fileId,
                    novelId,
                    content: chunk,
                    contentHash: hashContent(chunk),
                    embedding: JSON.stringify(embeddingVector),
                })

            } catch (embError) {
                console.warn(`[Embedding] 切片 ${i + 1} 向量化失败:`, embError)
                // 即使向量化失败，也存储文本
                await db.insert(embeddings).values({
                    fileId,
                    novelId,
                    content: chunk,
                    contentHash: hashContent(chunk),
                    embedding: '[]',
                })
            }
        }

        console.log(`[Embedding] 完成！共插入 ${chunks.length} 个向量`)
        return true

    } catch (error) {
        console.error(`[Embedding] 更新向量失败:`, error)
        return false
    }
}

/**
 * 删除文件的所有向量
 */
export async function deleteFileEmbeddings(fileId: string): Promise<boolean> {
    try {
        const db = await getDatabase()
        await db.delete(embeddings).where(eq(embeddings.fileId, fileId))
        console.log(`[Embedding] 已删除文件 ${fileId} 的所有向量`)
        return true
    } catch (error) {
        console.error(`[Embedding] 删除向量失败:`, error)
        return false
    }
}

/**
 * 语义搜索 - 根据查询找到相关内容
 */
export async function semanticSearch(
    query: string,
    novelId: string = 'default-novel',
    topK: number = 5
): Promise<Array<{ content: string; score: number; fileId: string | null }>> {
    try {
        const db = await getDatabase()

        const queryVector = await generateEmbedding(query)

        const allEmbeddings = await db.select()
            .from(embeddings)
            .where(eq(embeddings.novelId, novelId))

        type EmbRow = typeof embeddings.$inferSelect
        type Result = { content: string; score: number; fileId: string | null }

        const results: Result[] = allEmbeddings
            .map((emb: EmbRow): Result => {
                const embVector = JSON.parse(emb.embedding || '[]')
                const score = cosineSimilarity(queryVector, embVector)
                return {
                    content: emb.content,
                    score,
                    fileId: emb.fileId
                }
            })
            .filter((r: Result) => r.score > 0)
            .sort((a: Result, b: Result) => b.score - a.score)
            .slice(0, topK)

        return results

    } catch (error) {
        console.error(`[Embedding] 语义搜索失败:`, error)
        return []
    }
}
