/**
 * Rhythm Agent - 流量节奏监控器
 * 
 * 后台分析服务，检测文章是否"太水"
 * - 冲突密度检测
 * - 剧情转折判断
 */

import { chatCompletion } from '../tauri-api'

// 分析结果
export interface PacingAnalysisResult {
    // 冲突密度 (0-1)
    conflictDensity: number
    // 是否有剧情转折
    hasPlotTwist: boolean
    // 状态：green/yellow/red
    status: 'green' | 'yellow' | 'red'
    // 警告消息
    warning?: string
    // 建议
    suggestions: string[]
}

// 高唤醒词库（冲突相关）
const HIGH_AROUSAL_WORDS = [
    // 情绪词
    '怒', '愤', '恨', '恐', '惊', '惧', '慌', '急', '狂',
    // 动作词
    '杀', '死', '血', '伤', '砍', '刺', '撞', '逃', '追',
    // 冲突词
    '骂', '吼', '喊', '呵斥', '咆哮', '嘲讽', '威胁',
    // 情感高潮词
    '吻', '泪', '哭', '笑', '颤', '抖', '痛',
    // 转折词
    '竟', '居然', '突然', '忽然', '没想到', '意外',
]

// 剧情转折检测 Prompt
const PLOT_TWIST_DETECTOR_PROMPT = `你是一个剧情分析器。请判断以下文本中是否包含"预期违背"或"地位反转"。

预期违背：读者以为会发生 A，结果发生了 B
地位反转：角色的优势/劣势发生了翻转

只回答 YES 或 NO，不要任何解释。`

/**
 * 计算冲突密度
 * @param text 文本内容
 * @returns 冲突密度 (0-1)
 */
function calculateConflictDensity(text: string): number {
    if (!text || text.length === 0) return 0

    let totalMatches = 0

    for (const word of HIGH_AROUSAL_WORDS) {
        const regex = new RegExp(word, 'g')
        const matches = text.match(regex)
        if (matches) {
            totalMatches += matches.length
        }
    }

    // 按每 100 字计算密度
    const density = (totalMatches / text.length) * 100
    return Math.min(density, 1)  // 上限为 1
}

/**
 * 检测是否有剧情转折（调用轻量 AI）
 */
async function detectPlotTwist(text: string): Promise<boolean> {
    try {
        // 取最后 500 字分析
        const recentText = text.slice(-500)

        const response = await chatCompletion(
            [
                { role: 'system', content: PLOT_TWIST_DETECTOR_PROMPT },
                { role: 'user', content: recentText }
            ],
            { maxTokens: 10, temperature: 0.1 }
        )

        return response.toUpperCase().includes('YES')

    } catch (error) {
        console.warn('[RhythmAgent] 转折检测失败:', error)
        return false
    }
}

/**
 * 分析节奏（主函数）
 * 
 * @param last1000Words 最近 1000 字文本
 * @param useAI 是否使用 AI 检测转折（默认 true）
 */
export async function analyzePacing(
    last1000Words: string,
    useAI: boolean = true
): Promise<PacingAnalysisResult> {
    console.log(`[RhythmAgent] 开始分析节奏，文本长度: ${last1000Words.length}`)

    // 1. 计算冲突密度
    const conflictDensity = calculateConflictDensity(last1000Words)
    console.log(`[RhythmAgent] 冲突密度: ${(conflictDensity * 100).toFixed(2)}%`)

    // 2. 检测剧情转折（可选，避免频繁调用 AI）
    let hasPlotTwist = false
    if (useAI && last1000Words.length >= 300) {
        hasPlotTwist = await detectPlotTwist(last1000Words)
        console.log(`[RhythmAgent] 剧情转折: ${hasPlotTwist ? '是' : '否'}`)
    }

    // 3. 判断状态
    let status: 'green' | 'yellow' | 'red' = 'green'
    let warning: string | undefined
    const suggestions: string[] = []

    // 冲突密度 < 0.5% 且没有转折 = 红灯
    if (conflictDensity < 0.005 && !hasPlotTwist) {
        status = 'red'
        warning = '⚠️ 警报：已 800+ 字无有效冲突！'
        suggestions.push('引入一个突发危机')
        suggestions.push('揭露一个隐藏的秘密')
        suggestions.push('让主角遭受挫折或受伤')
        suggestions.push('增加角色之间的对抗')
    }
    // 冲突密度 0.5%-1% 或有转折 = 黄灯
    else if (conflictDensity < 0.01 && !hasPlotTwist) {
        status = 'yellow'
        suggestions.push('节奏稍显平缓，考虑增加情节张力')
    }
    // 否则 = 绿灯
    else {
        status = 'green'
    }

    return {
        conflictDensity,
        hasPlotTwist,
        status,
        warning,
        suggestions
    }
}

/**
 * 快速检测（不使用 AI，仅统计词频）
 * 用于实时反馈，性能更好
 */
export function quickPacingCheck(text: string): {
    density: number
    status: 'green' | 'yellow' | 'red'
} {
    const density = calculateConflictDensity(text)

    let status: 'green' | 'yellow' | 'red' = 'green'
    if (density < 0.005) {
        status = 'red'
    } else if (density < 0.01) {
        status = 'yellow'
    }

    return { density, status }
}

/**
 * 获取建议文案
 */
export function getRandomSuggestion(): string {
    const suggestions = [
        '引入一个突发危机',
        '揭露一个隐藏的秘密',
        '让主角受伤或遭受挫折',
        '增加角色之间的对抗',
        '制造一个预期违背的反转',
        '让一个配角做出意外的选择',
        '主角发现被背叛',
        '引入一个强大的敌人',
    ]
    return suggestions[Math.floor(Math.random() * suggestions.length)]
}
