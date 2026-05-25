/**
 * CHANGES 协议解析器
 *
 * 解析 AI 输出中的 ---CHANGES--- 分隔符 + JSON
 */

import { type ParsedOutput, type ChangesPayload, emptyChanges, CHANGES_FIELDS } from './types'

const SEPARATOR = '---CHANGES---'

/**
 * 解析 AI 完整输出
 *
 * 输入格式:
 *   正文内容...
 *   ---CHANGES---
 *   { ...JSON... }
 */
export function parseOutput(rawOutput: string): ParsedOutput {
    const sepIndex = rawOutput.indexOf(SEPARATOR)

    // 没有分隔符 = 协议失败
    if (sepIndex === -1) {
        return {
            body: rawOutput.trim(),
            changes: null,
            rawChanges: '',
            parseError: '缺少 ---CHANGES--- 分隔符'
        }
    }

    const body = rawOutput.slice(0, sepIndex).trim()
    const tail = rawOutput.slice(sepIndex + SEPARATOR.length).trim()

    // 提取 JSON (可能被 ``` 包裹)
    const jsonStr = extractJson(tail)
    if (!jsonStr) {
        return {
            body,
            changes: null,
            rawChanges: tail,
            parseError: 'CHANGES 段未找到合法 JSON'
        }
    }

    try {
        const parsed = JSON.parse(jsonStr)
        const changes = normalizeChanges(parsed)
        return {
            body,
            changes,
            rawChanges: jsonStr,
            parseError: null
        }
    } catch (e) {
        return {
            body,
            changes: null,
            rawChanges: jsonStr,
            parseError: `JSON 解析失败: ${e instanceof Error ? e.message : '未知'}`
        }
    }
}

/**
 * 从文本中提取 JSON 块
 * 支持 ```json {...} ``` 或纯 {...}
 */
function extractJson(text: string): string | null {
    // 优先匹配 ```json ... ```
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) {
        return fenceMatch[1].trim()
    }

    // 匹配第一个 { 到最后一个 } 的内容
    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        return text.slice(firstBrace, lastBrace + 1)
    }

    return null
}

/**
 * 规范化 CHANGES (补全缺失字段)
 */
function normalizeChanges(raw: unknown): ChangesPayload {
    const base = emptyChanges()
    if (!raw || typeof raw !== 'object') return base

    const obj = raw as Record<string, unknown>

    for (const field of CHANGES_FIELDS) {
        if (field === 'timeAdvance') {
            // timeAdvance 可以是 null 或对象
            if (obj[field] && typeof obj[field] === 'object') {
                base.timeAdvance = obj[field] as ChangesPayload['timeAdvance']
            }
        } else {
            // 其他字段都是数组
            if (Array.isArray(obj[field])) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ;(base as any)[field] = obj[field]
            }
        }
    }

    return base
}

/**
 * 序列化 CHANGES 为可读字符串 (用于日志/UI)
 */
export function summarizeChanges(changes: ChangesPayload): string {
    const lines: string[] = []
    if (changes.characterStateChanges.length)
        lines.push(`角色状态: ${changes.characterStateChanges.length} 项`)
    if (changes.conflictProgress.length)
        lines.push(`冲突推进: ${changes.conflictProgress.length} 项`)
    if (changes.newPlotNodes.length)
        lines.push(`新剧情节点: ${changes.newPlotNodes.length} 项`)
    if (changes.foreshadowActions.length)
        lines.push(`伏笔动作: ${changes.foreshadowActions.length} 项`)
    if (changes.characterMovements.length)
        lines.push(`角色移动: ${changes.characterMovements.length} 项`)
    if (changes.itemTransfers.length)
        lines.push(`物品流转: ${changes.itemTransfers.length} 项`)
    if (changes.secretReveals.length)
        lines.push(`秘密揭示: ${changes.secretReveals.length} 项`)
    if (changes.oathChanges.length)
        lines.push(`誓约变化: ${changes.oathChanges.length} 项`)
    if (changes.deadlineChanges.length)
        lines.push(`截止变化: ${changes.deadlineChanges.length} 项`)
    if (changes.timeAdvance)
        lines.push(`时间推进: ${changes.timeAdvance.elapsedTime}`)
    return lines.join(' · ') || '无变更'
}
