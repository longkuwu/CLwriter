/**
 * Gate 2: 引用校验门禁
 *
 * 检查:
 *   - CHANGES 中引用的所有 ID (角色/地点/势力) 必须在 entities 表中存在
 *   - 或者必须在本章正文中实际登场过 (新角色登记)
 */

import type { GateContext, GateResult, GateError } from './types'

export function gate2Reference(ctx: GateContext): GateResult {
    const errors: GateError[] = []
    const { parsed, entities } = ctx

    if (!parsed.changes) {
        return { gate: 'gate2_reference', passed: false, errors: [{ code: 'NO_CHANGES', message: 'CHANGES 不存在' }], warnings: [] }
    }

    const c = parsed.changes
    const body = parsed.body

    // 构建已登记实体 ID 集合 (按 type 分组)
    const charIds = new Set(entities.filter(e => e.type === 'character').map(e => e.name))
    const locIds = new Set(entities.filter(e => e.type === 'location').map(e => e.name))
    const facIds = new Set(entities.filter(e => e.type === 'faction').map(e => e.name))
    const foreshadowIds = new Set(entities.filter(e => e.type === 'foreshadow').map(e => e.name))
    const conflictIds = new Set(entities.filter(e => e.type === 'conflict').map(e => e.name))
    const oathIds = new Set(entities.filter(e => e.type === 'oath').map(e => e.name))
    const deadlineIds = new Set(entities.filter(e => e.type === 'deadline').map(e => e.name))
    const secretIds = new Set(entities.filter(e => e.type === 'secret').map(e => e.name))

    // 角色 ID 验证 (允许新角色,但必须在正文出现)
    for (const cs of c.characterStateChanges) {
        if (!charIds.has(cs.characterId) && !body.includes(cs.characterId)) {
            errors.push({
                code: 'CHAR_NOT_FOUND',
                message: `角色 "${cs.characterId}" 既不在档案中,也未在正文出现`,
                field: 'characterStateChanges',
                value: cs.characterId
            })
        }
        // 关系目标
        for (const r of cs.relationChanges || []) {
            if (!charIds.has(r.targetId) && !body.includes(r.targetId)) {
                errors.push({
                    code: 'CHAR_NOT_FOUND',
                    message: `关系目标 "${r.targetId}" 不存在`,
                    field: 'characterStateChanges.relationChanges',
                    value: r.targetId
                })
            }
        }
    }

    // 角色移动
    for (const m of c.characterMovements) {
        if (!charIds.has(m.characterId) && !body.includes(m.characterId)) {
            errors.push({
                code: 'CHAR_NOT_FOUND',
                message: `移动角色 "${m.characterId}" 不存在`,
                field: 'characterMovements',
                value: m.characterId
            })
        }
        if (m.toLocationId && !locIds.has(m.toLocationId) && !body.includes(m.toLocationId)) {
            errors.push({
                code: 'LOC_NOT_FOUND',
                message: `目的地点 "${m.toLocationId}" 不存在`,
                field: 'characterMovements.toLocationId',
                value: m.toLocationId
            })
        }
    }

    // 地点状态
    for (const l of c.locationStateChanges) {
        if (!locIds.has(l.locationId) && !body.includes(l.locationId)) {
            errors.push({
                code: 'LOC_NOT_FOUND',
                message: `地点 "${l.locationId}" 不存在`,
                field: 'locationStateChanges',
                value: l.locationId
            })
        }
    }

    // 势力状态
    for (const f of c.factionStateChanges) {
        if (!facIds.has(f.factionId) && !body.includes(f.factionId)) {
            errors.push({
                code: 'FAC_NOT_FOUND',
                message: `势力 "${f.factionId}" 不存在`,
                field: 'factionStateChanges',
                value: f.factionId
            })
        }
    }

    // 伏笔: payoff/reinforce 必须引用已存在的伏笔
    for (const fa of c.foreshadowActions) {
        if (fa.action === 'payoff' || fa.action === 'reinforce') {
            const exists = foreshadowIds.has(fa.foreshadowId) ||
                ctx.prevSnapshot?.foreshadowStates.some(x => x.foreshadowId === fa.foreshadowId)
            if (!exists) {
                errors.push({
                    code: 'FORESHADOW_NOT_FOUND',
                    message: `伏笔 "${fa.foreshadowId}" 不存在 (无法 ${fa.action})`,
                    field: 'foreshadowActions',
                    value: fa.foreshadowId
                })
            }
        }
    }

    // 冲突进度
    for (const cp of c.conflictProgress) {
        if (!conflictIds.has(cp.conflictId) && !ctx.prevSnapshot?.conflictStates.some(x => x.conflictId === cp.conflictId) && !body.includes(cp.conflictId)) {
            errors.push({
                code: 'CONFLICT_NOT_FOUND',
                message: `冲突 "${cp.conflictId}" 不存在`,
                field: 'conflictProgress',
                value: cp.conflictId
            })
        }
    }

    // 誓约: fulfill/break/extend 必须引用已存在的誓约
    for (const o of c.oathChanges) {
        if (o.action !== 'create') {
            const exists = oathIds.has(o.oathId) ||
                ctx.prevSnapshot?.oathStates.some(x => x.oathId === o.oathId)
            if (!exists) {
                errors.push({
                    code: 'OATH_NOT_FOUND',
                    message: `誓约 "${o.oathId}" 不存在 (无法 ${o.action})`,
                    field: 'oathChanges',
                    value: o.oathId
                })
            }
        }
    }

    // 截止: trigger/expire/extend
    for (const d of c.deadlineChanges) {
        if (d.action !== 'create') {
            const exists = deadlineIds.has(d.deadlineId) ||
                ctx.prevSnapshot?.deadlineStates.some(x => x.deadlineId === d.deadlineId)
            if (!exists) {
                errors.push({
                    code: 'DEADLINE_NOT_FOUND',
                    message: `截止约束 "${d.deadlineId}" 不存在`,
                    field: 'deadlineChanges',
                    value: d.deadlineId
                })
            }
        }
    }

    // 秘密揭示: 秘密本身必须存在
    for (const sr of c.secretReveals) {
        const exists = secretIds.has(sr.secretId) ||
            ctx.prevSnapshot?.secretStates.some(x => x.secretId === sr.secretId)
        if (!exists) {
            errors.push({
                code: 'SECRET_NOT_FOUND',
                message: `秘密 "${sr.secretId}" 不存在`,
                field: 'secretReveals',
                value: sr.secretId
            })
        }
    }

    return {
        gate: 'gate2_reference',
        passed: errors.length === 0,
        errors,
        warnings: []
    }
}
