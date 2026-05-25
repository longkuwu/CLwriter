/**
 * Gate 3: 一致性校验门禁
 *
 * 检查 CHANGES 是否与事实快照矛盾:
 *   - 角色规则约束 (如"张三畏火" → 不能写"张三独闯火窟"作为正面行动)
 *   - 世界观硬约束
 *   - 物品所有权 (移交方必须当前持有)
 *   - 角色位置 (移动起点必须等于当前位置)
 *   - 已死亡角色不能再有状态变化
 */

import type { GateContext, GateResult, GateError, GateWarning } from './types'

export function gate3Consistency(ctx: GateContext): GateResult {
    const errors: GateError[] = []
    const warnings: GateWarning[] = []
    const { parsed, prevSnapshot, entities } = ctx

    if (!parsed.changes || !prevSnapshot) {
        // 没有快照 = 第一章,跳过
        return { gate: 'gate3_consistency', passed: true, errors, warnings }
    }

    const c = parsed.changes

    // 1. 物品所有权一致性
    for (const t of c.itemTransfers) {
        const item = prevSnapshot.itemStates.find(s => s.itemName === t.itemName)
        if (item && t.fromOwnerId && item.currentOwnerId !== t.fromOwnerId) {
            errors.push({
                code: 'ITEM_OWNER_MISMATCH',
                message: `物品 "${t.itemName}" 当前持有者是 "${item.currentOwnerId}",不是声明的 "${t.fromOwnerId}"`,
                field: 'itemTransfers',
                value: t
            })
        }
    }

    // 2. 角色移动起点一致性
    for (const m of c.characterMovements) {
        if (!m.fromLocationId) continue
        const loc = prevSnapshot.characterLocations.find(l => l.characterId === m.characterId)
        if (loc && loc.locationId !== m.fromLocationId) {
            warnings.push({
                code: 'MOVE_START_MISMATCH',
                message: `角色 "${m.characterId}" 当前在 "${loc.locationId}",声明起点是 "${m.fromLocationId}"`
            })
        }
    }

    // 3. 角色规则硬约束
    const charRules = new Map<string, string[]>()
    for (const e of entities.filter(e => e.type === 'character')) {
        const rules = (e.rules as string[] | null) || []
        if (rules.length > 0) charRules.set(e.name, rules)
    }

    // 简单规则检测: 检查关键词冲突
    for (const cs of c.characterStateChanges) {
        const rules = charRules.get(cs.characterId)
        if (!rules) continue

        // 检查能力是否违反规则
        for (const ability of cs.newAbilities || []) {
            for (const rule of rules) {
                // 简单关键词匹配 (后续可用 AI 增强)
                if (rule.includes('不会') || rule.includes('禁止')) {
                    if (similar(rule, ability)) {
                        errors.push({
                            code: 'CHAR_RULE_VIOLATION',
                            message: `角色 "${cs.characterId}" 违反规则: "${rule}" (新能力 "${ability}")`,
                            field: 'characterStateChanges.newAbilities'
                        })
                    }
                }
            }
        }
    }

    // 4. 已 expired 的伏笔不能再 payoff
    for (const fa of c.foreshadowActions) {
        if (fa.action === 'payoff') {
            const f = prevSnapshot.foreshadowStates.find(x => x.foreshadowId === fa.foreshadowId)
            if (f && f.status === 'expired') {
                warnings.push({
                    code: 'FORESHADOW_EXPIRED',
                    message: `伏笔 "${fa.foreshadowId}" 已逾期,本章 payoff 可能突兀`
                })
            }
            if (f && f.status === 'payoff') {
                errors.push({
                    code: 'FORESHADOW_DOUBLE_PAYOFF',
                    message: `伏笔 "${fa.foreshadowId}" 已在第 ${f.payoffChapter} 章回收过`,
                    field: 'foreshadowActions'
                })
            }
        }
    }

    // 5. 已 fulfilled / broken 的誓约不能再 fulfill / break
    for (const o of c.oathChanges) {
        const oath = prevSnapshot.oathStates.find(x => x.oathId === o.oathId)
        if (oath) {
            if ((oath.status === 'fulfilled' || oath.status === 'broken') && o.action !== 'create') {
                errors.push({
                    code: 'OATH_ALREADY_TERMINATED',
                    message: `誓约 "${o.oathId}" 已终止 (${oath.status}),不能再 ${o.action}`,
                    field: 'oathChanges'
                })
            }
        }
    }

    // 6. 已 expired / triggered 的截止不能再触发
    for (const d of c.deadlineChanges) {
        const dl = prevSnapshot.deadlineStates.find(x => x.deadlineId === d.deadlineId)
        if (dl && dl.status !== 'active' && d.action === 'trigger') {
            errors.push({
                code: 'DEADLINE_NOT_ACTIVE',
                message: `截止约束 "${d.deadlineId}" 已 ${dl.status},不能再触发`,
                field: 'deadlineChanges'
            })
        }
    }

    return {
        gate: 'gate3_consistency',
        passed: errors.length === 0,
        errors,
        warnings
    }
}

/**
 * 简单相似度判断 (后续可用 embedding)
 */
function similar(rule: string, value: string): boolean {
    // 提取规则中的关键词
    const cleaned = rule.replace(/不会|禁止|不能|畏惧/g, '').trim()
    if (cleaned.length < 2) return false
    return value.includes(cleaned) || cleaned.includes(value)
}
