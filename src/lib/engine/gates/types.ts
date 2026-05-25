/**
 * 6 道生成门禁 - 类型定义
 *
 * 门禁是"硬栏杆": 不通过 = 章节不落地,AI 重写
 */

import type { ParsedOutput } from '../changes/types'
import type { FactSnapshot } from '../snapshot/types'
import type { EntityRecord } from '../../db/schema'

export type GateName =
    | 'gate1_protocol'        // 协议解析
    | 'gate2_reference'       // 引用校验
    | 'gate3_consistency'     // 一致性
    | 'gate4_unknown'         // 未知实体
    | 'gate5_description'     // 描写一致性
    | 'gate6_blueprint'       // 蓝图出场

export interface GateError {
    code: string
    message: string
    field?: string
    value?: unknown
}

export interface GateWarning {
    code: string
    message: string
}

export interface GateResult {
    gate: GateName
    passed: boolean
    errors: GateError[]
    warnings: GateWarning[]
}

export interface GateContext {
    projectId: string
    chapterId: string
    chapterOrder: number
    parsed: ParsedOutput
    prevSnapshot: FactSnapshot | null
    entities: EntityRecord[]
    blueprint?: ChapterBlueprint        // 章节蓝图
}

export interface ChapterBlueprint {
    title: string
    targetCharacterIds: string[]        // 必须出场的角色
    targetLocationIds: string[]
    targetFactionIds: string[]
    pivotCharacterId?: string           // 视角角色
    expectedScenes: string[]
    minWordCount?: number
    maxWordCount?: number
}

export interface OrchestratorResult {
    overallPassed: boolean
    results: GateResult[]
    errorCount: number
    warningCount: number
}
