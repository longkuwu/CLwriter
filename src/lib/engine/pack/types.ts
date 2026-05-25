/**
 * 数据中心打包 - 类型定义
 *
 * 灵感: 天命的"数据中心打包"
 * 核心: AI 每章只看本章相关的数据,而不是整本书
 */

import type { FactSnapshot, ForeshadowState, ConflictState } from '../snapshot/types'
import type { ChapterBlueprint } from '../gates/types'
import type { EntityRecord } from '../../db/schema'

/**
 * 章节生成数据包 - AI 每章实际读取的数据
 */
export interface ChapterPack {
    // 基础信息
    chapterOrder: number
    blueprint: ChapterBlueprint | null

    // 1. 五大规则 (本章引用的)
    fiveRules: {
        worldview: string[]                  // 本章相关世界观规则
        characters: EntityRecord[]           // 本章涉及角色档案
        factions: EntityRecord[]             // 本章涉及势力
        locations: EntityRecord[]            // 本章涉及地点
        plotRules: string[]                  // 剧情规则
    }

    // 2. 大纲 + 当前卷
    outlineSlice: {
        bookTitle: string
        currentVolume: string
        volumeOutline: string
    }

    // 3. 章节计划 + 蓝图
    chapterPlan: {
        title: string
        synopsis: string
        sceneList: string[]
    }

    // 4. 创意素材模板
    templates: string[]

    // 5. 事实快照 (15 维) - 截止上一章
    factSnapshot: FactSnapshot | null

    // 6. 前章摘要链 (前 N 章递进式摘要)
    summaryChain: Array<{
        chapterOrder: number
        summary: string
    }>

    // 7. 前章尾段 (上一章结尾原文片段,衔接用)
    prevTail: string | null

    // 8. 历史里程碑 (跨卷关键事件)
    milestones: Array<{
        chapterOrder: number
        title: string
        summary: string
    }>

    // 9. 向量召回片段 (按语义相关性挑选的历史切片)
    vectorRecall: Array<{
        chapterOrder: number
        snippet: string
        relevance: number
    }>

    // 10. 前卷事实归档 (已完结卷的最终状态)
    prevVolumeFacts: FactSnapshot | null

    // 11. 状态偏离警告 (检测到快照异常时的修复提示)
    driftWarnings: string[]

    // 12. 场景指引 (蓝图中本章场景的详细执行引导)
    sceneGuide: string

    // 附加: 待处理伏笔 / 进行中冲突 / 倒计时截止
    activeForeshadows: ForeshadowState[]
    activeConflicts: ConflictState[]
    activeDeadlines: string[]
}
