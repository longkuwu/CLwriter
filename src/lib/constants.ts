/**
 * IP Architect v5.2 - 核心常量定义
 * 
 * 流量爆款引擎与自适应拆解阈值
 */

// ========== 字数阈值 ==========

/** 
 * 长文本阈值临界点
 * - < 20,000: 轻量模式 (Lite Mode) - 全息直通
 * - 20k-60k: 智能模式 (Smart Mode) - 语义切分
 * - > 60,000: 宏观模式 (Mega Mode) - 分块映射
 */
export const LONG_TEXT_THRESHOLD = 20000

/** 超长文本阈值（启用 Map-Reduce） */
export const MEGA_TEXT_THRESHOLD = 60000

// ========== 分析模式 ==========

export type AnalysisMode = 'lite' | 'smart' | 'mega'

export function getAnalysisMode(wordCount: number): AnalysisMode {
    if (wordCount < LONG_TEXT_THRESHOLD) {
        return 'lite'
    } else if (wordCount < MEGA_TEXT_THRESHOLD) {
        return 'smart'
    } else {
        return 'mega'
    }
}

export function getAnalysisModeLabel(mode: AnalysisMode): { icon: string; name: string; description: string } {
    switch (mode) {
        case 'lite':
            return {
                icon: '🟢',
                name: '轻量模式 (Lite Mode)',
                description: '启用全息深度拆解。适合知乎/公众号/短篇。'
            }
        case 'smart':
            return {
                icon: '🟡',
                name: '智能模式 (Smart Mode)',
                description: '启用语义场景切分。适合中篇连载/短剧脚本。'
            }
        case 'mega':
            return {
                icon: '🟣',
                name: '宏观模式 (Mega Mode)',
                description: '启用结构分块映射。适合番茄/百度长篇连载。'
            }
    }
}

// ========== 切片配置 ==========

/** 智能切分默认块大小 */
export const SMART_CHUNK_SIZE = 4000

/** 宏观模式默认块大小 */
export const MEGA_CHUNK_SIZE = 5000

// ========== 引擎类型 ==========

export type EngineType = 'epic' | 'viral'

export const ENGINE_LABELS = {
    epic: { icon: '🏰', name: '宏大叙事', description: '起点/晋江长篇、西幻、修真' },
    viral: { icon: '🔥', name: '流量爆款', description: '知乎/番茄/公众号/短剧脚本' }
} as const
