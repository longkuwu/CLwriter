/**
 * 门禁编排器
 *
 * 按顺序执行 6 道门禁,任何一道失败都会标记整体失败
 * 但所有门禁都会执行,以便给用户完整的错误清单
 */

import type { GateContext, GateResult, OrchestratorResult } from './types'
import { gate1Protocol } from './gate1-protocol'
import { gate2Reference } from './gate2-reference'
import { gate3Consistency } from './gate3-consistency'
import { gate4Unknown } from './gate4-unknown'
import { gate5Description } from './gate5-description'
import { gate6Blueprint } from './gate6-blueprint'

export async function runAllGates(ctx: GateContext): Promise<OrchestratorResult> {
    const results: GateResult[] = []

    // Gate 1 失败 (协议错误) 后续门禁会缺少基础数据,但仍可执行 (它们会自己处理)
    results.push(gate1Protocol(ctx))

    // 即使 Gate 1 失败,后续 Gate 也尝试运行,提供更多反馈
    results.push(gate2Reference(ctx))
    results.push(gate3Consistency(ctx))
    results.push(gate4Unknown(ctx))
    results.push(gate5Description(ctx))
    results.push(gate6Blueprint(ctx))

    const errorCount = results.reduce((s, r) => s + r.errors.length, 0)
    const warningCount = results.reduce((s, r) => s + r.warnings.length, 0)
    const overallPassed = results.every(r => r.passed)

    return {
        overallPassed,
        results,
        errorCount,
        warningCount
    }
}

/**
 * 生成门禁错误的反馈提示词 (用于让 AI 重写)
 */
export function buildGateFeedback(result: OrchestratorResult): string {
    const lines: string[] = ['【门禁未通过 - 请根据以下问题修改后重新输出】', '']

    for (const r of result.results) {
        if (r.errors.length === 0 && r.warnings.length === 0) continue
        lines.push(`━━ ${gateNameZh(r.gate)} ${r.passed ? '⚠️ 警告' : '❌ 失败'} ━━`)
        for (const e of r.errors) lines.push(`  ❌ [${e.code}] ${e.message}`)
        for (const w of r.warnings) lines.push(`  ⚠️ [${w.code}] ${w.message}`)
        lines.push('')
    }

    lines.push('请修复以上问题,重新输出完整的正文 + ---CHANGES--- 段。')
    return lines.join('\n')
}

function gateNameZh(name: string): string {
    const map: Record<string, string> = {
        gate1_protocol: '门禁1: 协议解析',
        gate2_reference: '门禁2: 引用校验',
        gate3_consistency: '门禁3: 一致性',
        gate4_unknown: '门禁4: 未知实体',
        gate5_description: '门禁5: 描写一致性',
        gate6_blueprint: '门禁6: 蓝图出场'
    }
    return map[name] || name
}
