/**
 * 章节生成的 System Prompt 构建器
 *
 * 把 ChapterPack 序列化为 AI 可读的提示词
 */

import type { ChapterPack } from '../pack/types'
import { CHANGES_PROTOCOL_PROMPT } from '../changes/prompt'
import type { FactSnapshot } from '../snapshot/types'

const SYSTEM_BASE = `你是一名专业的网络小说作家。你将基于"数据驱动写作"的方式创作章节内容。

写作要求:
1. 严格遵循下方提供的"事实快照"和"角色档案",不要编造与档案矛盾的内容
2. 必须按章节蓝图中的"必出场角色"和"场景清单"展开
3. 注意伏笔回收时机和时间线一致性
4. 文笔流畅,场景生动,情感细腻
5. 字数 2000-3500 字 (除非蓝图另有指定)

完成正文后,你必须按照本提示末尾的"CHANGES 协议"输出一段 JSON,声明本章发生的所有状态变化。
状态变化是下一章生成的输入,任何遗漏都会导致后续章节出现矛盾。`

/**
 * 构建章节生成的完整 System Prompt
 */
export function buildChapterSystemPrompt(pack: ChapterPack): string {
    const sections: string[] = [SYSTEM_BASE]

    // 1. 章节蓝图
    if (pack.blueprint) {
        sections.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【本章蓝图】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
标题: ${pack.blueprint.title}
${pack.blueprint.pivotCharacterId ? `视角角色: ${pack.blueprint.pivotCharacterId}` : ''}

必出场角色: ${pack.blueprint.targetCharacterIds.join('、') || '(无指定)'}
关联地点: ${pack.blueprint.targetLocationIds.join('、') || '(无指定)'}
关联势力: ${pack.blueprint.targetFactionIds.join('、') || '(无指定)'}

场景清单:
${pack.blueprint.expectedScenes.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}

字数要求: ${pack.blueprint.minWordCount || 2000} - ${pack.blueprint.maxWordCount || 3500} 字`)
    }

    // 2. 五大规则
    if (pack.fiveRules.characters.length > 0) {
        sections.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【角色档案】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${pack.fiveRules.characters.map(c => formatCharacterCard(c)).join('\n\n')}`)
    }

    if (pack.fiveRules.locations.length > 0) {
        sections.push(`
【地点档案】
${pack.fiveRules.locations.map(l => formatLocationCard(l)).join('\n')}`)
    }

    if (pack.fiveRules.factions.length > 0) {
        sections.push(`
【势力档案】
${pack.fiveRules.factions.map(f => `- ${f.name}: ${f.archetype || ''}`).join('\n')}`)
    }

    if (pack.fiveRules.worldview.length > 0) {
        sections.push(`
【世界观规则 (硬约束,不可违反)】
${pack.fiveRules.worldview.map(r => `- ${r}`).join('\n')}`)
    }

    // 3. 事实快照 (核心)
    if (pack.factSnapshot) {
        sections.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【事实快照 - 截止上一章】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${formatSnapshot(pack.factSnapshot)}`)
    }

    // 4. 活跃伏笔 (重点提示 AI 回收时机)
    if (pack.activeForeshadows.length > 0) {
        sections.push(`
【⚡ 活跃伏笔 - 注意回收时机】
${pack.activeForeshadows.map(f =>
    `- [${f.tier === 1 ? 'Tier1·重要' : f.tier === 2 ? 'Tier2' : 'Tier3'}] ${f.foreshadowId}: ${f.description} (已埋 ${f.chaptersSinceSetup} 章)`
).join('\n')}`)
    }

    // 5. 进行中冲突
    if (pack.activeConflicts.length > 0) {
        sections.push(`
【🔥 进行中冲突】
${pack.activeConflicts.map(c => `- ${c.name} [${c.status}]: ${c.progress.slice(-1)[0] || ''}`).join('\n')}`)
    }

    // 6. 倒计时
    if (pack.activeDeadlines.length > 0) {
        sections.push(`
【⏰ 倒计时约束】
${pack.activeDeadlines.map(d => `- ${d}`).join('\n')}`)
    }

    // 7. 状态偏离警告
    if (pack.driftWarnings.length > 0) {
        sections.push(`
【⚠️ 状态提醒】
${pack.driftWarnings.join('\n')}`)
    }

    // 8. 历史里程碑
    if (pack.milestones.length > 0) {
        sections.push(`
【历史里程碑】
${pack.milestones.slice(0, 5).map(m => `- 第${m.chapterOrder}章: ${m.title}`).join('\n')}`)
    }

    // 9. 前章衔接
    if (pack.prevTail) {
        sections.push(`
【前章结尾 (用于衔接)】
${pack.prevTail}`)
    }

    // 10. CHANGES 协议
    sections.push('\n' + CHANGES_PROTOCOL_PROMPT)

    return sections.join('\n')
}

// ========== 格式化辅助 ==========

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatCharacterCard(e: any): string {
    const lines = [`◆ ${e.name}`]
    const attrs = e.attributes as Record<string, unknown> | null
    if (attrs) {
        for (const [k, v] of Object.entries(attrs)) {
            if (v) lines.push(`  ${k}: ${v}`)
        }
    }
    const rules = e.rules as string[] | null
    if (rules && rules.length > 0) {
        lines.push(`  规则约束: ${rules.join('; ')}`)
    }
    return lines.join('\n')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatLocationCard(e: any): string {
    const attrs = e.attributes as Record<string, unknown> | null
    const desc = attrs?.description || ''
    return `- ${e.name}: ${desc}`
}

function formatSnapshot(s: FactSnapshot): string {
    const lines: string[] = []

    // 角色当前状态
    if (s.characterStates.length > 0) {
        lines.push('◆ 角色状态:')
        for (const cs of s.characterStates.slice(-15)) {
            const parts = [`  ${cs.name}`]
            if (cs.realm) parts.push(cs.realm)
            if (cs.abilities.length > 0) parts.push(`能力[${cs.abilities.join(',')}]`)
            if (cs.psychState) parts.push(`心理: ${cs.psychState}`)
            if (cs.lastEvent) parts.push(`近况: ${cs.lastEvent}`)
            lines.push(parts.join(' · '))
        }
    }

    // 角色位置
    if (s.characterLocations.length > 0) {
        lines.push('\n◆ 角色位置:')
        for (const l of s.characterLocations.slice(-15)) {
            lines.push(`  ${l.characterId} → ${l.locationName} (第${l.arrivedAt}章到达)`)
        }
    }

    // 时间线
    if (s.timeline.length > 0) {
        const last = s.timeline[s.timeline.length - 1]
        lines.push(`\n◆ 当前时间: ${last.period} (距上一章经过 ${last.elapsedSinceLast})`)
    }

    // 重要物品
    if (s.itemStates.length > 0) {
        lines.push('\n◆ 重要物品:')
        for (const it of s.itemStates.slice(-10)) {
            lines.push(`  ${it.itemName} → ${it.currentOwnerId || '无人'} [${it.status}]`)
        }
    }

    // 已知秘密
    if (s.secretStates.length > 0) {
        lines.push('\n◆ 秘密状态:')
        for (const sec of s.secretStates) {
            lines.push(`  ${sec.name}: ${sec.status} (知情人 ${sec.knowerIds.length} 个)`)
        }
    }

    // 活跃誓约
    const activeOaths = s.oathStates.filter(o => o.status === 'active')
    if (activeOaths.length > 0) {
        lines.push('\n◆ 活跃誓约:')
        for (const o of activeOaths) {
            lines.push(`  ${o.name}: ${o.constraint}`)
        }
    }

    return lines.join('\n')
}
