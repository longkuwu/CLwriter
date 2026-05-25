/**
 * Gate 6: 蓝图出场检查门禁
 *
 * 检查蓝图指定的角色/势力/地点是否在正文中实际出现:
 *   - 视角角色仅出现 1 次会警告"叙事力度不足"
 *   - 必出场角色完全缺席 → 打回
 */

import type { GateContext, GateResult, GateError, GateWarning } from './types'

const ABSENCE_FAIL_RATIO = 0.4   // 缺席比例超过 40% 打回

export function gate6Blueprint(ctx: GateContext): GateResult {
    const errors: GateError[] = []
    const warnings: GateWarning[] = []
    const { parsed, blueprint } = ctx

    if (!blueprint) {
        // 没有蓝图 = 自由创作,跳过
        return { gate: 'gate6_blueprint', passed: true, errors, warnings }
    }

    const body = parsed.body

    // 1. 必出场角色检查
    const absent: string[] = []
    const present: string[] = []
    for (const cid of blueprint.targetCharacterIds) {
        const count = countOccurrences(body, cid)
        if (count === 0) absent.push(cid)
        else present.push(cid)
    }

    const absenceRatio = blueprint.targetCharacterIds.length > 0
        ? absent.length / blueprint.targetCharacterIds.length
        : 0

    if (absenceRatio > ABSENCE_FAIL_RATIO) {
        errors.push({
            code: 'BLUEPRINT_ABSENCE',
            message: `蓝图指定 ${blueprint.targetCharacterIds.length} 个角色,有 ${absent.length} 个完全缺席: ${absent.join(', ')}`,
            value: absent
        })
    } else if (absent.length > 0) {
        warnings.push({
            code: 'BLUEPRINT_PARTIAL_ABSENCE',
            message: `部分蓝图角色缺席: ${absent.join(', ')}`
        })
    }

    // 2. 视角角色叙事力度
    if (blueprint.pivotCharacterId) {
        const pivotCount = countOccurrences(body, blueprint.pivotCharacterId)
        if (pivotCount === 0) {
            errors.push({
                code: 'PIVOT_ABSENT',
                message: `视角角色 "${blueprint.pivotCharacterId}" 完全未出现`
            })
        } else if (pivotCount === 1) {
            warnings.push({
                code: 'PIVOT_WEAK',
                message: `视角角色 "${blueprint.pivotCharacterId}" 仅出现 1 次,叙事力度不足`
            })
        }
    }

    // 3. 地点出现检查
    const absentLocs: string[] = []
    for (const lid of blueprint.targetLocationIds) {
        if (!body.includes(lid)) absentLocs.push(lid)
    }
    if (absentLocs.length > 0) {
        warnings.push({
            code: 'BLUEPRINT_LOC_ABSENT',
            message: `蓝图地点未在正文出现: ${absentLocs.join(', ')}`
        })
    }

    // 4. 势力出现检查
    const absentFacs: string[] = []
    for (const fid of blueprint.targetFactionIds) {
        if (!body.includes(fid)) absentFacs.push(fid)
    }
    if (absentFacs.length > 0) {
        warnings.push({
            code: 'BLUEPRINT_FAC_ABSENT',
            message: `蓝图势力未在正文出现: ${absentFacs.join(', ')}`
        })
    }

    // 5. 字数约束
    if (blueprint.minWordCount && body.length < blueprint.minWordCount) {
        errors.push({
            code: 'WORD_COUNT_BELOW_MIN',
            message: `正文 ${body.length} 字,低于蓝图最低要求 ${blueprint.minWordCount} 字`
        })
    }
    if (blueprint.maxWordCount && body.length > blueprint.maxWordCount * 1.3) {
        warnings.push({
            code: 'WORD_COUNT_OVER',
            message: `正文 ${body.length} 字,超过蓝图最高建议 ${blueprint.maxWordCount} 字 30% 以上`
        })
    }

    return {
        gate: 'gate6_blueprint',
        passed: errors.length === 0,
        errors,
        warnings
    }
}

function countOccurrences(text: string, substr: string): number {
    if (!substr) return 0
    let count = 0
    let pos = 0
    while ((pos = text.indexOf(substr, pos)) !== -1) {
        count++
        pos += substr.length
    }
    return count
}
