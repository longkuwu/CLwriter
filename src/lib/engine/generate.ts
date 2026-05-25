/**
 * 章节生成主流程 - 串起整个状态驱动闭环
 *
 *   1. packChapter → 组装数据包
 *   2. buildChapterSystemPrompt → 生成 System Prompt
 *   3. 调用 LLM 生成正文 + CHANGES
 *   4. parseOutput → 解析输出
 *   5. runAllGates → 6 道门禁校验
 *   6. 通过 → projectSnapshot → 落地状态
 *      未通过 → 喂给 LLM 反馈,让它重写 (最多 N 次)
 */

import { chatCompletion } from '../tauri-api'
import { packChapter } from './pack/packager'
import { buildChapterSystemPrompt } from './prompts/chapter'
import { parseOutput } from './changes/parser'
import { runAllGates, buildGateFeedback } from './gates/orchestrator'
import { projectSnapshot } from './snapshot/projector'
import { getLatestSnapshot, saveSnapshot } from './snapshot/manager'
import { getDatabase } from '../db'
import { entities, chapterChanges, gateLogs } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import type { ChapterBlueprint } from './gates/types'
import type { OrchestratorResult } from './gates/types'
import type { ChangesPayload } from './changes/types'

export interface GenerateOptions {
    projectId: string
    chapterId: string
    chapterOrder: number
    blueprint?: ChapterBlueprint
    maxRetries?: number             // 门禁失败重试次数 (默认 2)
    extraInstruction?: string        // 用户额外指令
}

export interface GenerateResult {
    success: boolean
    body: string
    changes: ChangesPayload | null
    gateResult: OrchestratorResult | null
    retries: number
    error?: string
}

const DEFAULT_MAX_RETRIES = 2

/**
 * 状态驱动的章节生成主流程
 */
export async function generateChapterWithEngine(
    options: GenerateOptions
): Promise<GenerateResult> {
    const {
        projectId,
        chapterId,
        chapterOrder,
        blueprint,
        maxRetries = DEFAULT_MAX_RETRIES,
        extraInstruction
    } = options

    console.log(`[Engine] 开始生成第 ${chapterOrder} 章`)

    // === Step 1: 组装数据包 ===
    const pack = await packChapter(projectId, chapterOrder, blueprint)
    console.log(`[Engine] 数据包: 角色=${pack.fiveRules.characters.length}, 伏笔=${pack.activeForeshadows.length}, 冲突=${pack.activeConflicts.length}`)

    // === Step 2: 构建 System Prompt ===
    const systemPrompt = buildChapterSystemPrompt(pack)

    // === Step 3: 准备实体列表 (供门禁使用) ===
    const allEntities = await loadEntities(projectId)
    const prevSnapshot = await getLatestSnapshot(projectId)

    // === Step 4: 生成 + 校验 + 重试循环 ===
    let userPrompt = extraInstruction
        ? `请按照蓝图创作本章。补充指令: ${extraInstruction}`
        : '请按照蓝图创作本章正文,完成后输出 ---CHANGES--- 段。'

    let lastBody = ''
    let lastChanges: ChangesPayload | null = null
    let lastGateResult: OrchestratorResult | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        console.log(`[Engine] 尝试 ${attempt + 1}/${maxRetries + 1}`)

        // 调用 LLM
        let raw: string
        try {
            raw = await chatCompletion(
                [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                { temperature: 0.8, maxTokens: 6000 }
            )
        } catch (e) {
            console.error('[Engine] LLM 调用失败:', e)
            return {
                success: false,
                body: '',
                changes: null,
                gateResult: null,
                retries: attempt,
                error: e instanceof Error ? e.message : 'LLM 调用失败'
            }
        }

        // 解析
        const parsed = parseOutput(raw)
        lastBody = parsed.body
        lastChanges = parsed.changes

        // 6 道门禁
        const gateResult = await runAllGates({
            projectId,
            chapterId,
            chapterOrder,
            parsed,
            prevSnapshot,
            entities: allEntities,
            blueprint
        })
        lastGateResult = gateResult

        // 记录门禁日志
        await logGateResults(projectId, chapterId, chapterOrder, gateResult)

        if (gateResult.overallPassed) {
            console.log(`[Engine] ✅ 门禁全部通过 (尝试 ${attempt + 1} 次)`)

            // === Step 5: 落地状态 ===
            await persistChanges(projectId, chapterId, chapterOrder, parsed.rawChanges, gateResult)

            if (parsed.changes) {
                const newSnapshot = projectSnapshot(prevSnapshot, parsed.changes, chapterId, chapterOrder)
                await saveSnapshot(projectId, newSnapshot)
                console.log(`[Engine] 快照已更新: 伏笔=${newSnapshot.foreshadowStates.length}, 节点=${newSnapshot.plotNodes.length}`)
            }

            return {
                success: true,
                body: parsed.body,
                changes: parsed.changes,
                gateResult,
                retries: attempt
            }
        }

        // 失败 → 构建反馈喂给 LLM
        console.warn(`[Engine] 门禁失败,错误 ${gateResult.errorCount} 个,警告 ${gateResult.warningCount} 个`)

        if (attempt < maxRetries) {
            userPrompt = `${buildGateFeedback(gateResult)}\n\n请基于上述反馈重新输出完整的正文 + ---CHANGES---。`
        }
    }

    // 用尽重试次数仍失败
    console.error('[Engine] ❌ 超出重试次数,生成失败')
    return {
        success: false,
        body: lastBody,
        changes: lastChanges,
        gateResult: lastGateResult,
        retries: maxRetries,
        error: `门禁连续 ${maxRetries + 1} 次未通过`
    }
}

// ========== 辅助函数 ==========

async function loadEntities(projectId: string) {
    try {
        const db = await getDatabase()
        return await db.select()
            .from(entities)
            .where(and(
                eq(entities.projectId, projectId),
                eq(entities.status, 'active')
            ))
    } catch (e) {
        console.error('[Engine] 读取实体失败:', e)
        return []
    }
}

async function persistChanges(
    projectId: string,
    chapterId: string,
    chapterOrder: number,
    rawChanges: string,
    gateResult: OrchestratorResult
) {
    try {
        const db = await getDatabase()
        await db.insert(chapterChanges).values({
            projectId,
            chapterId,
            chapterOrder,
            rawChanges: rawChanges ? JSON.parse(rawChanges) : {},
            gateResults: gateResult.results,
            status: 'applied'
        })
    } catch (e) {
        console.error('[Engine] 持久化 CHANGES 失败:', e)
    }
}

async function logGateResults(
    projectId: string,
    chapterId: string,
    chapterOrder: number,
    result: OrchestratorResult
) {
    try {
        const db = await getDatabase()
        for (const r of result.results) {
            await db.insert(gateLogs).values({
                projectId,
                chapterId,
                chapterOrder,
                gateName: r.gate,
                passed: r.passed,
                errors: r.errors,
                warnings: r.warnings
            })
        }
    } catch (e) {
        console.error('[Engine] 记录门禁日志失败:', e)
    }
}
