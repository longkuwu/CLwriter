/**
 * CHANGES 协议 - 12 类变更声明的类型定义
 *
 * 灵感: 天命的 ---CHANGES--- 协议
 * 核心: AI 必须在正文后输出结构化变更声明,缺一类都打回
 */

// ========== 1. 角色状态变化 ==========
export interface CharacterStateChange {
    characterId: string
    realm?: string              // 境界/等级
    newAbilities?: string[]     // 新增能力
    lostAbilities?: string[]    // 失去能力
    psychState?: string         // 心理状态
    keyEvents?: string[]        // 关键事件
    relationChanges?: Array<{   // 关系变化
        targetId: string
        trustDelta: number      // 信任度变化 -100~+100
        note?: string
    }>
}

// ========== 2. 冲突进度 ==========
export interface ConflictProgress {
    conflictId: string
    newStatus: 'pending' | 'active' | 'resolved' | 'escalated'
    progressEvent: string
}

// ========== 3. 新剧情节点 ==========
export interface PlotNode {
    keyword: string
    summary: string
    involvedCharacters: string[]
    storyline: 'main' | 'side' | 'background'
}

// ========== 4. 伏笔动作 ==========
export interface ForeshadowAction {
    foreshadowId: string
    action: 'setup' | 'payoff' | 'reinforce'
    note?: string
}

// ========== 5. 地点状态变化 ==========
export interface LocationStateChange {
    locationId: string
    newStatus: string
    triggerEvent: string
}

// ========== 6. 势力状态变化 ==========
export interface FactionStateChange {
    factionId: string
    newStatus: string
    triggerEvent: string
}

// ========== 7. 时间推进 ==========
export interface TimeAdvance {
    currentPeriod: string       // 当前时段 (如 "黄昏")
    elapsedTime: string         // 经过时间 (如 "三日")
    keyTimeEvents?: string[]
}

// ========== 8. 角色移动 ==========
export interface CharacterMovement {
    characterId: string
    fromLocationId: string | null
    toLocationId: string
    note?: string
}

// ========== 9. 物品流转 ==========
export interface ItemTransfer {
    itemName: string
    fromOwnerId: string | null
    toOwnerId: string | null    // null = 丢失/销毁
    itemStatus: 'active' | 'broken' | 'sealed' | 'lost'
}

// ========== 10. 秘密揭示 ==========
export interface SecretReveal {
    secretId: string
    newKnowerIds: string[]      // 新知情角色
    revealMethod: string
}

// ========== 11. 誓约约束变化 ==========
export interface OathChange {
    oathId: string
    action: 'create' | 'fulfill' | 'break' | 'extend'
    relatedCharacters: string[]
    constraint?: string         // 约束条件
    consequence?: string        // 后果
}

// ========== 12. 截止约束变化 ==========
export interface DeadlineChange {
    deadlineId: string
    action: 'create' | 'trigger' | 'expire' | 'extend'
    triggerCondition?: string
    countdownTo?: string        // 倒计时截止
}

// ========== 完整 CHANGES 包 ==========
export interface ChangesPayload {
    characterStateChanges: CharacterStateChange[]
    conflictProgress: ConflictProgress[]
    newPlotNodes: PlotNode[]
    foreshadowActions: ForeshadowAction[]
    locationStateChanges: LocationStateChange[]
    factionStateChanges: FactionStateChange[]
    timeAdvance: TimeAdvance | null
    characterMovements: CharacterMovement[]
    itemTransfers: ItemTransfer[]
    secretReveals: SecretReveal[]
    oathChanges: OathChange[]
    deadlineChanges: DeadlineChange[]
}

// ========== 协议解析结果 ==========
export interface ParsedOutput {
    body: string                // 正文
    changes: ChangesPayload | null
    rawChanges: string          // 原始 JSON 字符串
    parseError: string | null
}

/**
 * 创建空的 CHANGES 包
 */
export function emptyChanges(): ChangesPayload {
    return {
        characterStateChanges: [],
        conflictProgress: [],
        newPlotNodes: [],
        foreshadowActions: [],
        locationStateChanges: [],
        factionStateChanges: [],
        timeAdvance: null,
        characterMovements: [],
        itemTransfers: [],
        secretReveals: [],
        oathChanges: [],
        deadlineChanges: []
    }
}

/**
 * CHANGES 的 12 类字段名 (用于校验完整性)
 */
export const CHANGES_FIELDS = [
    'characterStateChanges',
    'conflictProgress',
    'newPlotNodes',
    'foreshadowActions',
    'locationStateChanges',
    'factionStateChanges',
    'timeAdvance',
    'characterMovements',
    'itemTransfers',
    'secretReveals',
    'oathChanges',
    'deadlineChanges'
] as const

export type ChangesField = typeof CHANGES_FIELDS[number]
