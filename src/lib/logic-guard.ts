/**
 * Logic Guard - 轻量级状态分析器
 * 
 * 监听 AI 生成的文本，根据关键词自动更新 Codex 状态
 */

// 状态变更类型
export interface StateChange {
    type: 'hp' | 'inventory' | 'location'
    action: 'decrease' | 'increase' | 'add' | 'remove' | 'set'
    value: number | string
    reason: string  // 触发原因（匹配的关键词）
}

// 分析结果
export interface AnalysisResult {
    changes: StateChange[]
    hasChanges: boolean
}

// HP 减少关键词
const HP_DAMAGE_KEYWORDS = [
    '受伤', '吐血', '剧痛', '重伤', '倒地', '昏迷',
    '鲜血', '流血', '疼痛', '摔倒', '撞击', '击中',
    '刺入', '砍中', '打中', '中箭', '中毒'
]

// HP 恢复关键词
const HP_HEAL_KEYWORDS = [
    '恢复', '疗伤', '包扎', '喝药', '服药', '休息',
    '好转', '康复', '治愈'
]

// 获得物品关键词
const ITEM_ACQUIRE_KEYWORDS = [
    '获得', '捡起', '拿起', '拾取', '取得', '得到',
    '收下', '接过', '抓住', '握住'
]

// 失去物品关键词
const ITEM_LOSE_KEYWORDS = [
    '丢失', '丢弃', '扔掉', '失去', '破碎', '损坏',
    '交出', '放下'
]

// 地点关键词
const LOCATION_KEYWORDS = [
    '来到', '进入', '走进', '踏入', '抵达', '到达',
    '出现在', '站在'
]

/**
 * 从文本中提取名词（简单的中文名词提取）
 * 提取关键词后面的 2-6 个字符作为名词
 */
function extractNoun(text: string, keyword: string, maxLen: number = 6): string | null {
    const index = text.indexOf(keyword)
    if (index === -1) return null

    const afterKeyword = text.slice(index + keyword.length, index + keyword.length + maxLen)

    // 移除常见的助词和标点
    const cleaned = afterKeyword
        .replace(/[，。！？、；：""''【】（）\s]/g, '')
        .replace(/^(了|的|着|过|一|个|把)/g, '')

    if (cleaned.length < 2) return null
    return cleaned.slice(0, 6)  // 最多取6个字符
}

/**
 * 分析生成的文本，提取状态变更
 */
export function analyzeText(text: string): AnalysisResult {
    const changes: StateChange[] = []

    // 分析 HP 变化
    for (const keyword of HP_DAMAGE_KEYWORDS) {
        if (text.includes(keyword)) {
            changes.push({
                type: 'hp',
                action: 'decrease',
                value: 10,
                reason: keyword
            })
            break  // 只触发一次 HP 减少
        }
    }

    for (const keyword of HP_HEAL_KEYWORDS) {
        if (text.includes(keyword)) {
            changes.push({
                type: 'hp',
                action: 'increase',
                value: 10,
                reason: keyword
            })
            break
        }
    }

    // 分析物品获取
    for (const keyword of ITEM_ACQUIRE_KEYWORDS) {
        if (text.includes(keyword)) {
            const item = extractNoun(text, keyword)
            if (item) {
                changes.push({
                    type: 'inventory',
                    action: 'add',
                    value: item,
                    reason: keyword
                })
            }
        }
    }

    // 分析物品失去
    for (const keyword of ITEM_LOSE_KEYWORDS) {
        if (text.includes(keyword)) {
            const item = extractNoun(text, keyword)
            if (item) {
                changes.push({
                    type: 'inventory',
                    action: 'remove',
                    value: item,
                    reason: keyword
                })
            }
        }
    }

    // 分析地点变化
    for (const keyword of LOCATION_KEYWORDS) {
        if (text.includes(keyword)) {
            const location = extractNoun(text, keyword)
            if (location) {
                changes.push({
                    type: 'location',
                    action: 'set',
                    value: location,
                    reason: keyword
                })
                break  // 只取第一个地点
            }
        }
    }

    return {
        changes,
        hasChanges: changes.length > 0
    }
}

/**
 * 应用状态变更到 NovelState
 */
export interface NovelStateActions {
    updateState: (state: { hp?: number; location?: string }) => void
    addItem: (item: string) => void
    removeItem: (item: string) => void
    setLocation: (location: string) => void
}

export function applyChanges(
    currentState: { hp: number; inventory: string[]; location: string },
    changes: StateChange[],
    actions: NovelStateActions
): void {
    for (const change of changes) {
        switch (change.type) {
            case 'hp':
                if (change.action === 'decrease') {
                    const newHp = Math.max(0, currentState.hp - (change.value as number))
                    actions.updateState({ hp: newHp })
                    console.log(`[LogicGuard] HP 减少 ${change.value}，原因: ${change.reason}`)
                } else if (change.action === 'increase') {
                    const newHp = Math.min(100, currentState.hp + (change.value as number))
                    actions.updateState({ hp: newHp })
                    console.log(`[LogicGuard] HP 恢复 ${change.value}，原因: ${change.reason}`)
                }
                break

            case 'inventory':
                if (change.action === 'add') {
                    actions.addItem(change.value as string)
                    console.log(`[LogicGuard] 获得物品: ${change.value}，原因: ${change.reason}`)
                } else if (change.action === 'remove') {
                    actions.removeItem(change.value as string)
                    console.log(`[LogicGuard] 失去物品: ${change.value}，原因: ${change.reason}`)
                }
                break

            case 'location':
                if (change.action === 'set') {
                    actions.setLocation(change.value as string)
                    console.log(`[LogicGuard] 地点更新为: ${change.value}，原因: ${change.reason}`)
                }
                break
        }
    }
}
