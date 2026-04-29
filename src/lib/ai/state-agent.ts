/**
 * State Agent - 状态提取器
 * 
 * 从文本中自动提取主角状态：
 * - HP 变化（受伤减血，休息回血）
 * - 当前地点
 * - 获得/丢失的物品
 * - 故事内时间
 */

import { chatCompletion } from '../tauri-api'
import { useNovelStore, type WorldState } from '../store/novel-store'

// 状态提取结果
export interface ExtractedState {
    hp?: number
    location?: string
    items?: string[]
    time?: string
}

// 状态提取 Prompt
const STATE_EXTRACTION_PROMPT = `你是一个状态分析器。请分析文本，提取主角的当前状态。

【提取规则】
1. HP (生命值 0-100)：
   - 默认 100
   - 受伤、流血、中毒：-10 到 -50
   - 重伤、濒死：降至 10-30
   - 休息、治疗、吃药：+10 到 +30

2. 地点：
   - 提取具体场景名称
   - 使用"地名·具体位置"格式
   - 如："凛冬城·酒馆"、"黑森林·入口"

3. 物品：
   - 主角获得的新物品 → 添加
   - 主角丢失/使用的物品 → 移除
   - 只记录关键道具，忽略普通消耗品

4. 时间：
   - 提取故事内时间
   - 如："新历2077年 夜"、"第三天 黄昏"

【输出格式】
严格输出 JSON，不要任何其他文字：
{
  "hp": 85,
  "location": "凛冬城·酒馆",
  "items": ["生锈的铁剑", "神秘信件"],
  "time": "新历2077年 夜"
}

如果某项无法确定，使用 null。`

/**
 * 从文本中提取世界状态
 * 
 * @param content - 要分析的文本（推荐最近 1000-2000 字）
 * @param currentState - 当前状态（用于物品增减计算）
 */
export async function extractState(
    content: string,
    currentState?: WorldState
): Promise<ExtractedState | null> {
    if (!content || content.length < 100) {
        console.log('[StateAgent] 内容太短，跳过分析')
        return null
    }

    try {
        console.log(`[StateAgent] 开始提取状态，文本长度: ${content.length}`)

        // 取最近 1500 字分析
        const recentContent = content.slice(-1500)

        // 构建包含当前状态的上下文
        const contextPrompt = currentState
            ? `\n【当前状态参考】\nHP: ${currentState.hp}, 地点: ${currentState.location}, 物品: ${currentState.items.join(', ') || '无'}\n\n`
            : ''

        const response = await chatCompletion(
            [
                { role: 'system', content: STATE_EXTRACTION_PROMPT },
                { role: 'user', content: contextPrompt + recentContent }
            ],
            { maxTokens: 300, temperature: 0.2 }
        )

        // 解析 JSON 响应
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            console.warn('[StateAgent] 无法解析响应为 JSON:', response)
            return null
        }

        const parsed = JSON.parse(jsonMatch[0]) as ExtractedState

        console.log('[StateAgent] 提取成功:', parsed)
        return parsed

    } catch (error) {
        console.error('[StateAgent] 状态提取失败:', error)
        return null
    }
}

/**
 * 提取状态并直接更新 Store
 * 
 * @param content - 要分析的文本
 */
export async function extractAndUpdateState(content: string): Promise<boolean> {
    const currentState = useNovelStore.getState().worldState
    const extracted = await extractState(content, currentState)

    if (!extracted) {
        return false
    }

    // 处理物品增减
    let newItems = currentState.items
    if (extracted.items) {
        // 合并物品（去重）
        const itemSet = new Set([...currentState.items, ...extracted.items])
        newItems = Array.from(itemSet).slice(0, 10)  // 最多保留 10 个
    }

    // 更新 Store
    useNovelStore.getState().updateWorldState({
        hp: extracted.hp ?? currentState.hp,
        location: extracted.location ?? currentState.location,
        items: newItems,
        time: extracted.time ?? currentState.time
    })

    console.log('[StateAgent] Store 已更新')
    return true
}
