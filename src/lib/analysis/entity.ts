/**
 * Entity Analysis Module - 被动式归档系统
 * 
 * 分析文本中的实体（人名、地名、宝物名），
 * 识别新出现的设定并提示用户归档
 */

import { getDatabase } from '../db'
import { codex } from '../db/schema'
import { eq, and, like } from 'drizzle-orm'
import { chatCompletion } from '../tauri-api'

// 实体类型
export type EntityType = 'character' | 'location' | 'item' | 'event' | 'skill'

// 发现的实体
export interface DiscoveredEntity {
    name: string
    type: EntityType
    count: number
    context: string  // 首次出现的上下文
    isNew: boolean   // 是否为新实体
}

// 实体分析结果
export interface EntityAnalysisResult {
    entities: DiscoveredEntity[]
    success: boolean
    error?: string
}

// 实体提取系统提示
const ENTITY_EXTRACTION_PROMPT = `你是一个专业的小说分析助手。请从以下文本中提取所有具体的专有名词。

**提取类型**：
1. character - 人物名（如：林冲、张三丰）
2. location - 地点名（如：青云峰、长安城）
3. item - 物品/法宝（如：玄铁剑、九阳心经）
4. skill - 技能/功法（如：断水流、六脉神剑）
5. event - 重要事件（如：华山论剑）

**输出格式**（JSON数组）：
[
  {"name": "林冲", "type": "character", "context": "林冲提剑而立"},
  {"name": "青钢剑", "type": "item", "context": "获得青钢剑"}
]

**注意**：
- 只提取专有名词，忽略普通名词
- context 取包含该名词的那句话
- 如果没有发现实体，返回空数组 []
`

/**
 * 分析文本中的实体
 * 
 * @param text - 要分析的文本（通常是最近500-1000字）
 * @param novelId - 小说ID，用于比对已有实体
 */
export async function analyzeEntities(
    text: string,
    novelId: string
): Promise<EntityAnalysisResult> {
    console.log(`[Entity] 开始分析实体，文本长度: ${text.length}`)

    if (!text || text.trim().length < 50) {
        return { entities: [], success: true }
    }

    try {
        // 1. 使用 AI 提取实体
        const response = await chatCompletion(
            [
                { role: 'system', content: ENTITY_EXTRACTION_PROMPT },
                { role: 'user', content: text }
            ],
            { maxTokens: 1024, temperature: 0.3 }
        )

        // 2. 解析 JSON
        let extractedEntities: Array<{ name: string; type: EntityType; context: string }> = []
        try {
            const jsonMatch = response.match(/\[[\s\S]*\]/)
            if (jsonMatch) {
                extractedEntities = JSON.parse(jsonMatch[0])
            }
        } catch {
            console.warn('[Entity] JSON 解析失败:', response)
            return { entities: [], success: false, error: 'JSON 解析失败' }
        }

        // 3. 统计出现次数
        const entityCounts = new Map<string, number>()
        for (const entity of extractedEntities) {
            const count = (text.match(new RegExp(entity.name, 'g')) || []).length
            entityCounts.set(entity.name, count)
        }

        // 4. 检查是否为新实体（比对 codex）
        const db = await getDatabase()
        const discoveredEntities: DiscoveredEntity[] = []

        for (const entity of extractedEntities) {
            const count = entityCounts.get(entity.name) || 1

            // 查询 codex 是否已存在
            const existing = await db.select()
                .from(codex)
                .where(and(
                    eq(codex.novelId, novelId),
                    like(codex.content, `%${entity.name}%`)
                ))
                .limit(1)

            const isNew = existing.length === 0

            discoveredEntities.push({
                name: entity.name,
                type: entity.type,
                count,
                context: entity.context || '',
                isNew
            })
        }

        // 5. 过滤：只返回出现3次以上的新实体
        const significantEntities = discoveredEntities.filter(
            e => e.isNew && e.count >= 3
        )

        console.log(`[Entity] 发现 ${significantEntities.length} 个新实体`)
        return { entities: significantEntities, success: true }

    } catch (error) {
        console.error('[Entity] 分析失败:', error)
        return {
            entities: [],
            success: false,
            error: error instanceof Error ? error.message : '未知错误'
        }
    }
}

/**
 * 将实体归档到 Codex
 * 
 * @param novelId - 小说ID
 * @param entity - 要归档的实体
 */
export async function archiveEntityToCodex(
    novelId: string,
    entity: DiscoveredEntity
): Promise<boolean> {
    try {
        const db = await getDatabase()

        // 生成内容描述
        const content = `【${getTypeLabel(entity.type)}】${entity.name}\n\n首次出现上下文：${entity.context}`

        // 生成简单的内容哈希
        const contentHash = simpleHash(content)

        await db.insert(codex).values({
            novelId,
            content,
            contentHash,
            embedding: '[]',  // 暂时不生成向量
        })

        console.log(`[Entity] 已归档: ${entity.name}`)
        return true

    } catch (error) {
        console.error('[Entity] 归档失败:', error)
        return false
    }
}

/**
 * 获取类型标签
 */
function getTypeLabel(type: EntityType): string {
    const labels: Record<EntityType, string> = {
        character: '人物',
        location: '地点',
        item: '法宝',
        skill: '功法',
        event: '事件'
    }
    return labels[type] || '设定'
}

/**
 * 简单哈希函数
 */
function simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
    }
    return Math.abs(hash).toString(16)
}
