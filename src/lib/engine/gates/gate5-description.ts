/**
 * Gate 5: 描写一致性门禁
 *
 * 检查正文中的角色外貌描写是否与档案矛盾:
 *   - 发色 / 瞳色 / 身高 / 显著特征
 *   - 地点描写是否与地点特征冲突
 */

import type { GateContext, GateResult, GateError, GateWarning } from './types'

export function gate5Description(ctx: GateContext): GateResult {
    const errors: GateError[] = []
    const warnings: GateWarning[] = []
    const { parsed, prevSnapshot } = ctx

    if (!prevSnapshot || !parsed.body) {
        return { gate: 'gate5_description', passed: true, errors, warnings }
    }

    const body = parsed.body

    // 1. 角色外貌一致性
    for (const app of prevSnapshot.characterAppearances) {
        // 找正文中提到该角色的句子
        const charNamePattern = new RegExp(`[^。！？\\n]{0,30}${escapeRegex(app.characterId)}[^。！？\\n]{0,80}`, 'g')
        const sentences = body.match(charNamePattern) || []

        for (const sentence of sentences) {
            // 检查发色冲突
            if (app.hairColor) {
                const conflictHair = findConflictColor(sentence, app.hairColor, '发')
                if (conflictHair) {
                    errors.push({
                        code: 'APPEARANCE_HAIR_MISMATCH',
                        message: `角色 "${app.characterId}" 档案发色为 "${app.hairColor}",正文出现 "${conflictHair}发"`,
                        field: 'body'
                    })
                }
            }
            if (app.eyeColor) {
                const conflictEye = findConflictColor(sentence, app.eyeColor, '瞳')
                if (conflictEye) {
                    errors.push({
                        code: 'APPEARANCE_EYE_MISMATCH',
                        message: `角色 "${app.characterId}" 档案瞳色为 "${app.eyeColor}",正文出现 "${conflictEye}瞳"`,
                        field: 'body'
                    })
                }
            }
        }
    }

    // 2. 地点特征一致性 (简单版: 关键词冲突检测)
    for (const lf of prevSnapshot.locationFeatures) {
        const locInBody = body.includes(lf.locationId)
        if (!locInBody) continue

        // 检查环境描述冲突
        // 例: 档案是"岩浆遍布",正文写"冰天雪地"
        const conflicts = detectEnvironmentConflicts(body, lf)
        for (const c of conflicts) {
            warnings.push({
                code: 'LOCATION_DESC_MISMATCH',
                message: `地点 "${lf.locationId}" 特征 "${lf.environment}" 与正文 "${c}" 可能冲突`
            })
        }
    }

    return {
        gate: 'gate5_description',
        passed: errors.length === 0,
        errors,
        warnings
    }
}

const COLOR_KEYWORDS = ['黑', '白', '红', '金', '银', '紫', '蓝', '绿', '灰', '棕', '青', '碧']

function findConflictColor(sentence: string, expected: string, suffix: '发' | '瞳'): string | null {
    for (const c of COLOR_KEYWORDS) {
        if (c === expected[0] || expected.includes(c)) continue
        const pattern = new RegExp(`${c}[色]?${suffix}`)
        if (pattern.test(sentence)) return c
    }
    return null
}

const ENV_PAIRS: Array<[string, string[]]> = [
    ['岩浆', ['冰', '雪', '霜', '寒']],
    ['沙漠', ['湖', '河', '雨']],
    ['深海', ['火', '岩浆']],
    ['冰原', ['岩浆', '炎热']],
    ['火山', ['冰']],
]

function detectEnvironmentConflicts(body: string, lf: { environment: string }): string[] {
    const conflicts: string[] = []
    for (const [env, conflictKeywords] of ENV_PAIRS) {
        if (lf.environment.includes(env)) {
            for (const k of conflictKeywords) {
                if (body.includes(k)) conflicts.push(k)
            }
        }
    }
    return conflicts
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
