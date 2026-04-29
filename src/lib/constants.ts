/**
 * 全局常量定义
 */

// ========== 文本长度阈值 ==========

/**
 * 长文本阈值（3万字）
 * 超过此阈值使用智能分析模式
 */
export const LONG_TEXT_THRESHOLD = 30000

/**
 * 超长文本阈值（10万字）
 * 超过此阈值使用宏观分析模式
 */
export const MEGA_TEXT_THRESHOLD = 100000

// ========== 分析模式 ==========

export type AnalysisMode = 'lite' | 'smart' | 'mega'

export interface AnalysisModeConfig {
    name: string
    icon: string
    description: string
    threshold: number
}

export const ANALYSIS_MODES: Record<AnalysisMode, AnalysisModeConfig> = {
    lite: {
        name: '轻量模式',
        icon: '🟢',
        description: '快速分析，适合短文（<3万字）',
        threshold: 0
    },
    smart: {
        name: '智能模式',
        icon: '🟡',
        description: '深度分析，适合中长文（3-10万字）',
        threshold: LONG_TEXT_THRESHOLD
    },
    mega: {
        name: '宏观模式',
        icon: '🟣',
        description: '分块分析，适合超长文（>10万字）',
        threshold: MEGA_TEXT_THRESHOLD
    }
}

/**
 * 根据文本长度判断分析模式
 */
export function getAnalysisMode(textLength: number): AnalysisMode {
    if (textLength >= MEGA_TEXT_THRESHOLD) {
        return 'mega'
    } else if (textLength >= LONG_TEXT_THRESHOLD) {
        return 'smart'
    }
    return 'lite'
}

/**
 * 获取分析模式标签
 */
export function getAnalysisModeLabel(mode: AnalysisMode): AnalysisModeConfig {
    return ANALYSIS_MODES[mode]
}

// ========== 分块配置 ==========

/**
 * 默认分块大小（字符数）
 */
export const DEFAULT_CHUNK_SIZE = 5000

/**
 * 分块重叠大小（字符数）
 * 用于保持上下文连贯性
 */
export const CHUNK_OVERLAP = 500

/**
 * 每章平均字数（用于估算章节数）
 */
export const AVERAGE_CHAPTER_LENGTH = 3000

// ========== AI 配置 ==========

/**
 * 默认 AI 温度
 */
export const DEFAULT_TEMPERATURE = 0.7

/**
 * 默认最大 Token 数
 */
export const DEFAULT_MAX_TOKENS = 2048

/**
 * 流式生成默认最大 Token 数
 */
export const STREAM_MAX_TOKENS = 4000

// ========== 节奏监控配置 ==========

/**
 * 冲突密度阈值（红灯）
 */
export const CONFLICT_DENSITY_RED = 0.005

/**
 * 冲突密度阈值（黄灯）
 */
export const CONFLICT_DENSITY_YELLOW = 0.01

/**
 * 节奏检测窗口大小（字符数）
 */
export const RHYTHM_WINDOW_SIZE = 1000

// ========== 文件上传配置 ==========

/**
 * 支持的文件类型
 */
export const SUPPORTED_FILE_TYPES = ['.txt', '.md', '.markdown']

/**
 * 最大文件大小（字节）
 * 默认 10MB
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024

// ========== 导出格式 ==========

export const EXPORT_FORMATS = {
    DOCX: 'docx',
    MARKDOWN: 'md',
    TXT: 'txt'
} as const

export type ExportFormat = typeof EXPORT_FORMATS[keyof typeof EXPORT_FORMATS]

// ========== 平台类型 ==========

export const PLATFORMS = {
    TOMATO: 'tomato',
    ZHIHU: 'zhihu',
    TOUTIAO: 'toutiao'
} as const

export type PlatformType = typeof PLATFORMS[keyof typeof PLATFORMS]

// ========== 场景类型 ==========

export const SCENE_TYPES = {
    COMBAT: 'COMBAT',
    DAILY: 'DAILY',
    UNKNOWN: 'UNKNOWN'
} as const

export type SceneType = typeof SCENE_TYPES[keyof typeof SCENE_TYPES]

// ========== 情绪类型 ==========

export const MOOD_TYPES = [
    '压抑',
    '期待',
    '震惊',
    '爽',
    '燃',
    '感动',
    '好奇',
    '愤怒',
    '解气',
    '意外',
    '悬念',
    '平稳'
] as const

export type MoodType = typeof MOOD_TYPES[number]

// ========== 结构功能类型 ==========

export const STRUCTURE_FUNCTIONS = [
    '开篇',
    '铺垫',
    '转折',
    '高潮',
    '过渡',
    '收尾',
    '冲突',
    '解决'
] as const

export type StructureFunction = typeof STRUCTURE_FUNCTIONS[number]
