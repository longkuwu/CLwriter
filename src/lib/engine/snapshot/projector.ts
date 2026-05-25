/**
 * 快照投影器 - 把 CHANGES 应用到事实快照
 *
 * 这是状态驱动的核心:
 *   newSnapshot = project(prevSnapshot, changes, chapterOrder)
 */

import type { ChangesPayload } from '../changes/types'
import type { FactSnapshot, TimelineEntry } from './types'
import { emptySnapshot } from './types'

/**
 * 把 CHANGES 投影到下一章的快照
 *
 * @param prev 上一章的快照 (null 表示初始)
 * @param changes 本章的 CHANGES
 * @param chapterId 本章 ID
 * @param chapterOrder 本章序号
 */
export function projectSnapshot(
    prev: FactSnapshot | null,
    changes: ChangesPayload,
    chapterId: string,
    chapterOrder: number
): FactSnapshot {
    // 深拷贝上一章快照作为基础
    const next: FactSnapshot = prev
        ? structuredClone(prev)
        : emptySnapshot(chapterId, chapterOrder)

    next.chapterId = chapterId
    next.chapterOrder = chapterOrder
    next.updatedAt = new Date()

    // 1. 应用角色状态变化
    applyCharacterStates(next, changes)

    // 2. 应用角色移动
    applyMovements(next, changes, chapterOrder)

    // 3. 应用冲突进度
    applyConflicts(next, changes)

    // 4. 应用伏笔动作 (含已埋章节计数推进)
    applyForeshadows(next, changes, chapterOrder)

    // 5. 应用剧情节点
    applyPlotNodes(next, changes, chapterOrder)

    // 6. 应用地点状态
    applyLocations(next, changes, chapterOrder)

    // 7. 应用势力状态
    applyFactions(next, changes, chapterOrder)

    // 8. 应用时间推进
    applyTimeline(next, changes, chapterOrder)

    // 9. 应用物品流转
    applyItems(next, changes, chapterOrder)

    // 10. 应用秘密揭示
    applySecrets(next, changes, chapterOrder)

    // 11. 应用誓约变化
    applyOaths(next, changes, chapterOrder)

    // 12. 应用截止约束
    applyDeadlines(next, changes, chapterOrder)

    // 推进所有伏笔的"已埋章节数"
    advanceForeshadowAging(next, chapterOrder)

    return next
}

// ========== 各维度应用函数 ==========

function applyCharacterStates(snap: FactSnapshot, changes: ChangesPayload) {
    for (const c of changes.characterStateChanges) {
        let state = snap.characterStates.find(s => s.characterId === c.characterId)
        if (!state) {
            state = {
                characterId: c.characterId,
                name: c.characterId,
                abilities: [],
                relations: {}
            }
            snap.characterStates.push(state)
        }

        if (c.realm) state.realm = c.realm
        if (c.psychState) state.psychState = c.psychState
        if (c.newAbilities) {
            for (const a of c.newAbilities) {
                if (!state.abilities.includes(a)) state.abilities.push(a)
            }
        }
        if (c.lostAbilities) {
            state.abilities = state.abilities.filter(a => !c.lostAbilities!.includes(a))
        }
        if (c.keyEvents && c.keyEvents.length > 0) {
            state.lastEvent = c.keyEvents[c.keyEvents.length - 1]
        }
        if (c.relationChanges) {
            for (const r of c.relationChanges) {
                const cur = state.relations[r.targetId] || { trust: 0 }
                cur.trust = Math.max(-100, Math.min(100, cur.trust + r.trustDelta))
                if (r.note) cur.note = r.note
                state.relations[r.targetId] = cur
            }
        }
    }
}

function applyMovements(snap: FactSnapshot, changes: ChangesPayload, chapter: number) {
    for (const m of changes.characterMovements) {
        const existing = snap.characterLocations.find(l => l.characterId === m.characterId)
        if (existing) {
            existing.locationId = m.toLocationId
            existing.locationName = m.toLocationId
            existing.arrivedAt = chapter
        } else {
            snap.characterLocations.push({
                characterId: m.characterId,
                locationId: m.toLocationId,
                locationName: m.toLocationId,
                arrivedAt: chapter
            })
        }
    }
}

function applyConflicts(snap: FactSnapshot, changes: ChangesPayload) {
    for (const c of changes.conflictProgress) {
        let state = snap.conflictStates.find(s => s.conflictId === c.conflictId)
        if (!state) {
            state = {
                conflictId: c.conflictId,
                name: c.conflictId,
                status: c.newStatus,
                progress: [],
                relatedCharacters: []
            }
            snap.conflictStates.push(state)
        }
        state.status = c.newStatus
        state.progress.push(c.progressEvent)
    }
}

function applyForeshadows(snap: FactSnapshot, changes: ChangesPayload, chapter: number) {
    for (const f of changes.foreshadowActions) {
        let state = snap.foreshadowStates.find(s => s.foreshadowId === f.foreshadowId)

        if (!state) {
            // 新埋伏笔
            if (f.action === 'setup') {
                state = {
                    foreshadowId: f.foreshadowId,
                    name: f.foreshadowId,
                    description: f.note || '',
                    tier: 2,
                    status: 'setup',
                    setupChapter: chapter,
                    payoffChapter: null,
                    relatedEntities: [],
                    chaptersSinceSetup: 0
                }
                snap.foreshadowStates.push(state)
            }
            continue
        }

        if (f.action === 'reinforce') {
            state.status = 'reinforced'
        } else if (f.action === 'payoff') {
            state.status = 'payoff'
            state.payoffChapter = chapter
        } else if (f.action === 'setup') {
            // 已存在的伏笔再次 setup,忽略
        }
    }
}

function advanceForeshadowAging(snap: FactSnapshot, chapter: number) {
    for (const f of snap.foreshadowStates) {
        if (f.status === 'setup' || f.status === 'reinforced') {
            f.chaptersSinceSetup = chapter - f.setupChapter
            // Tier-1 超过 50 章未收 → expired
            if (f.tier === 1 && f.chaptersSinceSetup > 50) f.status = 'expired'
            // Tier-2 超过 100 章
            if (f.tier === 2 && f.chaptersSinceSetup > 100) f.status = 'expired'
            // Tier-3 超过 300 章
            if (f.tier === 3 && f.chaptersSinceSetup > 300) f.status = 'expired'
        }
    }
}

function applyPlotNodes(snap: FactSnapshot, changes: ChangesPayload, chapter: number) {
    for (const p of changes.newPlotNodes) {
        snap.plotNodes.push({
            chapterOrder: chapter,
            keyword: p.keyword,
            summary: p.summary,
            involvedCharacters: p.involvedCharacters,
            storyline: p.storyline
        })
    }
}

function applyLocations(snap: FactSnapshot, changes: ChangesPayload, chapter: number) {
    for (const l of changes.locationStateChanges) {
        let state = snap.locationStates.find(s => s.locationId === l.locationId)
        if (!state) {
            state = {
                locationId: l.locationId,
                name: l.locationId,
                status: l.newStatus,
                history: []
            }
            snap.locationStates.push(state)
        }
        state.status = l.newStatus
        state.history.push({ chapter, status: l.newStatus, event: l.triggerEvent })
    }
}

function applyFactions(snap: FactSnapshot, changes: ChangesPayload, chapter: number) {
    for (const f of changes.factionStateChanges) {
        let state = snap.factionStates.find(s => s.factionId === f.factionId)
        if (!state) {
            state = {
                factionId: f.factionId,
                name: f.factionId,
                status: f.newStatus,
                history: []
            }
            snap.factionStates.push(state)
        }
        state.status = f.newStatus
        state.history.push({ chapter, status: f.newStatus, event: f.triggerEvent })
    }
}

function applyTimeline(snap: FactSnapshot, changes: ChangesPayload, chapter: number) {
    if (!changes.timeAdvance) return
    const entry: TimelineEntry = {
        chapterOrder: chapter,
        period: changes.timeAdvance.currentPeriod,
        elapsedSinceLast: changes.timeAdvance.elapsedTime,
        keyEvents: changes.timeAdvance.keyTimeEvents || []
    }
    snap.timeline.push(entry)
}

function applyItems(snap: FactSnapshot, changes: ChangesPayload, chapter: number) {
    for (const t of changes.itemTransfers) {
        let state = snap.itemStates.find(s => s.itemName === t.itemName)
        if (!state) {
            state = {
                itemName: t.itemName,
                currentOwnerId: t.toOwnerId,
                status: t.itemStatus,
                history: []
            }
            snap.itemStates.push(state)
        }
        state.history.push({
            chapter,
            ownerId: state.currentOwnerId,
            status: state.status
        })
        state.currentOwnerId = t.toOwnerId
        state.status = t.itemStatus
    }
}

function applySecrets(snap: FactSnapshot, changes: ChangesPayload, chapter: number) {
    for (const s of changes.secretReveals) {
        let state = snap.secretStates.find(x => x.secretId === s.secretId)
        if (!state) {
            state = {
                secretId: s.secretId,
                name: s.secretId,
                description: '',
                knowerIds: [],
                status: 'hidden',
                revealHistory: []
            }
            snap.secretStates.push(state)
        }
        for (const k of s.newKnowerIds) {
            if (!state.knowerIds.includes(k)) state.knowerIds.push(k)
        }
        state.status = state.knowerIds.length > 3 ? 'revealed' : 'partial'
        state.revealHistory.push({
            chapter,
            revealedTo: s.newKnowerIds,
            method: s.revealMethod
        })
    }
}

function applyOaths(snap: FactSnapshot, changes: ChangesPayload, chapter: number) {
    for (const o of changes.oathChanges) {
        const state = snap.oathStates.find(s => s.oathId === o.oathId)

        if (o.action === 'create') {
            if (!state) {
                snap.oathStates.push({
                    oathId: o.oathId,
                    name: o.oathId,
                    relatedCharacters: o.relatedCharacters,
                    constraint: o.constraint || '',
                    consequence: o.consequence || '',
                    status: 'active',
                    createdChapter: chapter
                })
            }
        } else if (state) {
            if (o.action === 'fulfill') state.status = 'fulfilled'
            else if (o.action === 'break') state.status = 'broken'
            else if (o.action === 'extend') state.status = 'active'
        }
    }
}

function applyDeadlines(snap: FactSnapshot, changes: ChangesPayload, chapter: number) {
    for (const d of changes.deadlineChanges) {
        const state = snap.deadlineStates.find(s => s.deadlineId === d.deadlineId)

        if (d.action === 'create') {
            if (!state) {
                snap.deadlineStates.push({
                    deadlineId: d.deadlineId,
                    name: d.deadlineId,
                    triggerCondition: d.triggerCondition || '',
                    countdownTo: d.countdownTo || '',
                    status: 'active',
                    createdChapter: chapter
                })
            }
        } else if (state) {
            if (d.action === 'trigger') state.status = 'triggered'
            else if (d.action === 'expire') state.status = 'expired'
        }
    }
}
