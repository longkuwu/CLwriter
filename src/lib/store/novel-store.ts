/**
 * Novel Store - 全局小说编辑状态
 * 
 * 使用 Zustand 管理跨组件的编辑器内容状态
 * 用于解决 Genesis 生成内容同步到编辑器的问题
 */

import { create } from 'zustand'

// 章节内容
export interface ChapterContent {
    title: string
    content: string
}

// 预测分支类型
export type PredictionType = 'aggressive' | 'balanced' | 'surprise'

// 预测分支接口
export interface Prediction {
    type: PredictionType
    title: string
    description: string
}

// 左侧栏 Tab 类型
export type LeftTabId = 'genesis' | 'project' | 'previz' | 'tools' | 'deconstruct'

// 世界状态接口（Codex 可视化）
export interface WorldState {
    hp: number           // 主角当前生命值 (0-100)
    location: string     // 当前场景 (如: "凛冬城·酒馆")
    items: string[]      // 物品栏 (如: ["生锈的铁剑", "神秘信件"])
    time: string         // 故事内时间 (如: "新历 2077年 夜")
}

// Store 接口
interface NovelStore {
    // ===== 文件管理 =====
    // 当前编辑的文件 ID
    currentFileId: string | null
    // 当前编辑器内容
    currentContent: string
    // 用于强制刷新左侧列表的信号
    refreshTrigger: number

    // 设置当前文件
    setCurrentFile: (id: string, content: string) => void
    // 更新内容
    updateContent: (content: string) => void
    // 触发左侧列表刷新
    triggerRefresh: () => void

    // ===== 兼容旧接口 =====
    // 当前编辑器内容 (别名)
    content: string
    setContent: (text: string) => void

    // 当前章节信息
    currentChapter: ChapterContent | null
    setCurrentChapter: (chapter: ChapterContent) => void

    // 用于触发编辑器更新的信号
    shouldUpdateEditor: boolean
    triggerUpdate: () => void
    resetUpdateFlag: () => void

    // 世界观和大纲 (来自创世)
    worldLayers: Array<{ name: string; content: string }>
    setWorldLayers: (layers: Array<{ name: string; content: string }>) => void

    outline: Array<{ chapter: number; title: string; summary: string }>
    setOutline: (outline: Array<{ chapter: number; title: string; summary: string }>) => void

    // 当前小说 ID
    // 当前小说 ID (Deprecated -> currentProjectId)
    currentNovelId: string
    setCurrentNovelId: (id: string) => void

    // 当前项目 ID (新)
    currentProjectId: string | null
    setCurrentProjectId: (id: string) => void

    // 当前项目引擎类型 (epic | viral)
    currentEngineType: 'epic' | 'viral'
    setCurrentEngineType: (type: 'epic' | 'viral') => void

    // ===== 预演功能 =====
    // 预测分支数据
    predictions: Prediction[]
    setPredictions: (preds: Prediction[]) => void
    applyPrediction: (pred: Prediction) => void

    // 左侧栏当前 Tab
    activeLeftTab: LeftTabId
    setActiveLeftTab: (tab: LeftTabId) => void

    // 待填充的 Goal（由 applyPrediction 设置）
    pendingGoal: string
    setPendingGoal: (goal: string) => void

    // ===== 编辑器保存状态 =====
    // 是否有未保存的内容
    isDirty: boolean
    setDirty: (dirty: boolean) => void
    // 保存函数引用（由 Editor 设置，供其他组件调用）
    saveHandler: (() => Promise<void>) | null
    setSaveHandler: (handler: (() => Promise<void>) | null) => void
    // ===== 写作模式 =====
    writingMode: 'epic' | 'viral'
    setWritingMode: (mode: 'epic' | 'viral') => void

    // ===== 实体发现（被动归档） =====
    discoveredEntities: Array<{
        name: string
        type: string
        count: number
        context: string
    }>
    setDiscoveredEntities: (entities: Array<{
        name: string
        type: string
        count: number
        context: string
    }>) => void
    clearDiscoveredEntities: () => void

    // ===== 世界状态 (Codex 可视化) =====
    worldState: WorldState
    updateWorldState: (partial: Partial<WorldState>) => void
}

export const useNovelStore = create<NovelStore>((set) => ({
    // ===== 文件管理 =====
    currentFileId: null,
    currentContent: '',
    refreshTrigger: 0,

    setCurrentFile: (id, content) => set({
        currentFileId: id,
        currentContent: content,
        content: content,
        shouldUpdateEditor: true
    }),

    updateContent: (content) => set({
        currentContent: content,
        content: content
    }),

    triggerRefresh: () => set((state) => ({
        refreshTrigger: state.refreshTrigger + 1
    })),

    // ===== 兼容旧接口 =====
    // 编辑器内容
    content: '',
    setContent: (text) => set({ content: text, currentContent: text }),

    // 当前章节
    currentChapter: null,
    setCurrentChapter: (chapter) => set({
        currentChapter: chapter,
        content: chapter.content,
        currentContent: chapter.content,
        shouldUpdateEditor: true
    }),

    // 更新信号
    shouldUpdateEditor: false,
    triggerUpdate: () => set({ shouldUpdateEditor: true }),
    resetUpdateFlag: () => set({ shouldUpdateEditor: false }),

    // 世界观
    worldLayers: [],
    setWorldLayers: (layers) => set({ worldLayers: layers }),

    // 大纲
    outline: [],
    setOutline: (outline) => set({ outline: outline }),

    // 小说 ID
    // 小说 ID
    currentNovelId: 'default-novel',
    setCurrentNovelId: (id) => set({ currentNovelId: id }),

    // 项目 ID
    currentProjectId: null,
    setCurrentProjectId: (id) => set({ currentProjectId: id }),

    // 当前项目引擎类型
    currentEngineType: 'epic',
    setCurrentEngineType: (type) => set({ currentEngineType: type }),

    // ===== 预演功能 =====
    // 预测分支
    predictions: [],
    setPredictions: (preds) => set({ predictions: preds }),
    applyPrediction: (pred) => set({
        pendingGoal: pred.description,
        predictions: [],  // 选择后清空卡片
    }),

    // 左侧栏 Tab
    activeLeftTab: 'genesis',
    setActiveLeftTab: (tab) => set({ activeLeftTab: tab }),

    // 待填充 Goal
    pendingGoal: '',
    setPendingGoal: (goal) => set({ pendingGoal: goal }),

    // ===== 编辑器保存状态 =====
    isDirty: false,
    setDirty: (dirty) => set({ isDirty: dirty }),
    saveHandler: null,
    setSaveHandler: (handler) => set({ saveHandler: handler }),
    // ===== 写作模式 =====
    writingMode: 'epic',
    setWritingMode: (mode) => set({ writingMode: mode }),
    // ===== 实体发现（被动归档） =====
    discoveredEntities: [],
    setDiscoveredEntities: (entities) => set({ discoveredEntities: entities }),
    clearDiscoveredEntities: () => set({ discoveredEntities: [] }),

    // ===== 世界状态 (Codex 可视化) =====
    worldState: {
        hp: 100,
        location: '未知',
        items: [],
        time: '未知'
    },
    updateWorldState: (partial) => set((state) => ({
        worldState: { ...state.worldState, ...partial }
    })),
}))
