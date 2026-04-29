/**
 * Brainstorm 模块 - 剧情分支预测
 * 
 * 基于当前上下文和 Codex 状态，生成 3 个不同风格的剧情发展方向
 */

import { chatCompletion } from '../tauri-api'

// 分支类型
export interface PlotBranch {
    label: '激进' | '稳健' | '意外'
    emoji: string
    title: string
    description: string
}

// 预测结果
export interface BrainstormResult {
    branches: PlotBranch[]
    success: boolean
    error?: string
}

// 系统提示 - 剧情预测专用
const BRAINSTORM_SYSTEM_PROMPT = `你是一个资深网文策划师，精通各类剧情套路。
你的任务是基于当前剧情和设定，构思 3 个截然不同的后续发展方向。

输出格式必须是严格的 JSON 数组：
[
  { "label": "激进", "emoji": "🔥", "title": "简短标题", "description": "详细描述（50-80字）" },
  { "label": "稳健", "emoji": "🌊", "title": "简短标题", "description": "详细描述（50-80字）" },
  { "label": "意外", "emoji": "⚡", "title": "简短标题", "description": "详细描述（50-80字）" }
]

三个分支的风格要求：
- **激进 (🔥)**: 冲突升级，打脸、开战、正面对决，爽点密集
- **稳健 (🌊)**: 暂避锋芒，侧面描写、力量升级、布局铺垫
- **意外 (⚡)**: 引入新势力、突发事件、剧情反转

注意：只输出 JSON，不要有其他文字。`

/**
 * 预测剧情分支
 * 
 * @param currentContext - 当前光标前的文本上下文
 * @param codexData - Codex 状态数据（JSON 字符串）
 * @returns 3 个剧情分支建议
 */
export async function predictPlotBranches(
    currentContext: string,
    codexData: string
): Promise<BrainstormResult> {
    console.log('[Brainstorm] 开始预测剧情分支...')

    const userPrompt = `当前剧情上下文（最近 500 字）：
---
${currentContext || '（故事刚开始，暂无上下文）'}
---

角色/世界状态：
${codexData}

请基于以上信息，构思 3 个完全不同的剧情发展方向。`

    try {
        const response = await chatCompletion(
            [
                { role: 'system', content: BRAINSTORM_SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
            ],
            { maxTokens: 1024, temperature: 0.9 }  // 高温度增加创意多样性
        )

        // 解析 JSON 响应
        const jsonMatch = response.match(/\[[\s\S]*\]/)
        if (!jsonMatch) {
            console.error('[Brainstorm] 无法解析 AI 响应为 JSON:', response)
            return {
                branches: getDefaultBranches(),
                success: false,
                error: 'AI 响应格式错误'
            }
        }

        const branches = JSON.parse(jsonMatch[0]) as PlotBranch[]

        // 验证格式
        if (!Array.isArray(branches) || branches.length !== 3) {
            return {
                branches: getDefaultBranches(),
                success: false,
                error: '分支数量不正确'
            }
        }

        console.log('[Brainstorm] 预测完成，生成 3 个分支')
        return { branches, success: true }

    } catch (error) {
        console.error('[Brainstorm] 预测失败:', error)
        return {
            branches: getDefaultBranches(),
            success: false,
            error: error instanceof Error ? error.message : '未知错误'
        }
    }
}

/**
 * 默认分支（当 AI 调用失败时使用）
 */
function getDefaultBranches(): PlotBranch[] {
    return [
        {
            label: '激进',
            emoji: '🔥',
            title: '正面冲突',
            description: '主角不再隐忍，直接与对手正面对决，一战定胜负。'
        },
        {
            label: '稳健',
            emoji: '🌊',
            title: '暗中布局',
            description: '表面退让，暗中积蓄力量，等待最佳反击时机。'
        },
        {
            label: '意外',
            emoji: '⚡',
            title: '第三方介入',
            description: '一个神秘势力突然出现，彻底改变了当前局势。'
        }
    ]
}
