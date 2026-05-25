/**
 * 15 维事实快照 - 类型定义
 *
 * 灵感: 天命的 15 维事实快照系统
 * 核心: 每章生成后,把 CHANGES 投影到这 15 个维度,下一章直接读取字段值
 */

// ========== 1. 角色状态 ==========
export interface CharacterState {
    characterId: string
    name: string
    realm?: string                  // 当前境界
    abilities: string[]             // 当前拥有的能力
    psychState?: string             // 当前心理状态
    relations: Record<string, {     // 与其他角色的关系
        trust: number               // -100 ~ +100
        note?: string
    }>
    lastEvent?: string              // 最近的关键事件
}

// ========== 2. 角色位置 ==========
export interface CharacterLocation {
    characterId: string
    locationId: string
    locationName: string
    arrivedAt: number               // 章节序号
}

// ========== 3. 角色外貌 ==========
export interface CharacterAppearance {
    characterId: string
    hairColor?: string
    eyeColor?: string
    height?: string
    features: string[]              // 外观特征
    personalityTags: string[]       // 性格标签
}

// ========== 4. 冲突进度 ==========
export interface ConflictState {
    conflictId: string
    name: string
    status: 'pending' | 'active' | 'resolved' | 'escalated'
    progress: string[]              // 推进事件列表
    relatedCharacters: string[]
}

// ========== 5. 伏笔状态 (核心!) ==========
export interface ForeshadowState {
    foreshadowId: string
    name: string
    description: string
    tier: 1 | 2 | 3                 // 重要度分层
    status: 'setup' | 'reinforced' | 'payoff' | 'expired'
    setupChapter: number            // 埋设章节
    payoffChapter: number | null    // 回收章节 (null = 未收)
    relatedEntities: string[]
    chaptersSinceSetup: number      // 已埋多少章
}

// ========== 6. 剧情节点 ==========
export interface PlotNodeState {
    chapterOrder: number
    keyword: string
    summary: string
    involvedCharacters: string[]
    storyline: 'main' | 'side' | 'background'
}

// ========== 7. 地点状态 ==========
export interface LocationState {
    locationId: string
    name: string
    status: string                  // 当前状况
    history: Array<{                // 状态变更历史
        chapter: number
        status: string
        event: string
    }>
}

// ========== 8. 势力状态 ==========
export interface FactionState {
    factionId: string
    name: string
    status: string
    history: Array<{
        chapter: number
        status: string
        event: string
    }>
}

// ========== 9. 时间线 ==========
export interface TimelineEntry {
    chapterOrder: number
    period: string                  // 时段
    elapsedSinceLast: string        // 距上一章经过时间
    keyEvents: string[]
}

// ========== 10. 物品状态 ==========
export interface ItemState {
    itemName: string
    currentOwnerId: string | null
    status: 'active' | 'broken' | 'sealed' | 'lost'
    history: Array<{
        chapter: number
        ownerId: string | null
        status: string
    }>
}

// ========== 11. 世界观硬约束 ==========
export interface WorldConstraint {
    id: string
    rule: string                    // 如 "凡人不可飞行"
    severity: 'hard' | 'soft'       // 硬约束 / 软约束
}

// ========== 12. 地点特征 ==========
export interface LocationFeature {
    locationId: string
    name: string
    description: string
    environment: string             // 如 "岩浆遍布"
    accessibility: string           // 如 "难以进入"
}

// ========== 13. 秘密状态 ==========
export interface SecretState {
    secretId: string
    name: string
    description: string
    knowerIds: string[]             // 知情人列表
    status: 'hidden' | 'partial' | 'revealed'
    revealHistory: Array<{
        chapter: number
        revealedTo: string[]
        method: string
    }>
}

// ========== 14. 誓约约束 ==========
export interface OathState {
    oathId: string
    name: string
    relatedCharacters: string[]
    constraint: string
    consequence: string
    status: 'active' | 'fulfilled' | 'broken' | 'expired'
    createdChapter: number
}

// ========== 15. 截止约束 ==========
export interface DeadlineState {
    deadlineId: string
    name: string
    triggerCondition: string
    countdownTo: string
    status: 'active' | 'triggered' | 'expired'
    createdChapter: number
}

// ========== 完整 15 维快照 ==========
export interface FactSnapshot {
    chapterOrder: number            // 截止到第几章
    chapterId: string

    // 15 维数据
    characterStates: CharacterState[]
    characterLocations: CharacterLocation[]
    characterAppearances: CharacterAppearance[]
    conflictStates: ConflictState[]
    foreshadowStates: ForeshadowState[]
    plotNodes: PlotNodeState[]
    locationStates: LocationState[]
    factionStates: FactionState[]
    timeline: TimelineEntry[]
    itemStates: ItemState[]
    worldConstraints: WorldConstraint[]
    locationFeatures: LocationFeature[]
    secretStates: SecretState[]
    oathStates: OathState[]
    deadlineStates: DeadlineState[]

    updatedAt: Date
}

/**
 * 创建空快照
 */
export function emptySnapshot(chapterId = '', chapterOrder = 0): FactSnapshot {
    return {
        chapterId,
        chapterOrder,
        characterStates: [],
        characterLocations: [],
        characterAppearances: [],
        conflictStates: [],
        foreshadowStates: [],
        plotNodes: [],
        locationStates: [],
        factionStates: [],
        timeline: [],
        itemStates: [],
        worldConstraints: [],
        locationFeatures: [],
        secretStates: [],
        oathStates: [],
        deadlineStates: [],
        updatedAt: new Date()
    }
}
