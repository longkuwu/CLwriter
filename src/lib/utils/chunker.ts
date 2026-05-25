/**
 * 文本分块工具
 * 
 * 用于处理超长文本，支持：
 * - 智能分块
 * - 文件读取
 * - 元数据提取
 */

import {
    DEFAULT_CHUNK_SIZE,
    CHUNK_OVERLAP,
    AVERAGE_CHAPTER_LENGTH,
    LONG_TEXT_THRESHOLD,
    MEGA_TEXT_THRESHOLD,
    SUPPORTED_FILE_TYPES,
    MAX_FILE_SIZE
} from '../constants'

// ========== 类型定义 ==========

export interface TextChunk {
    index: number
    content: string
    startPos: number
    endPos: number
}

export interface ChunkResult {
    chunks: TextChunk[]
    metadata: TextMetadata
}

export interface TextMetadata {
    totalLength: number
    totalChunks: number
    estimatedChapters: number
    isLongContent: boolean
    isMegaContent: boolean
}

// ========== 文本分块 ==========

/**
 * 将长文本分块
 * @param text 原始文本
 * @param chunkSize 每块大小（默认 5000 字）
 * @param overlap 重叠大小（默认 500 字）
 * @returns 分块结果
 */
export function chunkText(
    text: string,
    chunkSize: number = DEFAULT_CHUNK_SIZE,
    overlap: number = CHUNK_OVERLAP
): ChunkResult {
    const chunks: TextChunk[] = []
    const totalLength = text.length

    // 如果文本很短，不需要分块
    if (totalLength <= chunkSize) {
        chunks.push({
            index: 0,
            content: text,
            startPos: 0,
            endPos: totalLength
        })
    } else {
        // 分块处理
        let startPos = 0
        let index = 0

        while (startPos < totalLength) {
            const endPos = Math.min(startPos + chunkSize, totalLength)
            const content = text.slice(startPos, endPos)

            chunks.push({
                index,
                content,
                startPos,
                endPos
            })

            // 下一块的起始位置（考虑重叠）
            startPos = endPos - overlap
            index++

            // 防止无限循环
            if (startPos >= totalLength - overlap) {
                break
            }
        }
    }

    // 生成元数据
    const metadata: TextMetadata = {
        totalLength,
        totalChunks: chunks.length,
        estimatedChapters: Math.ceil(totalLength / AVERAGE_CHAPTER_LENGTH),
        isLongContent: totalLength >= LONG_TEXT_THRESHOLD,
        isMegaContent: totalLength >= MEGA_TEXT_THRESHOLD
    }

    return { chunks, metadata }
}

/**
 * 智能分块（按段落边界）
 * 尽量在段落结束处分块，保持语义完整性
 */
export function smartChunkText(
    text: string,
    targetChunkSize: number = DEFAULT_CHUNK_SIZE
): ChunkResult {
    const chunks: TextChunk[] = []
    const paragraphs = text.split(/\n\n+/)  // 按空行分段

    let currentChunk = ''
    let currentStartPos = 0
    let index = 0

    for (const paragraph of paragraphs) {
        // 如果当前块 + 新段落超过目标大小，保存当前块
        if (currentChunk.length + paragraph.length > targetChunkSize && currentChunk.length > 0) {
            chunks.push({
                index,
                content: currentChunk.trim(),
                startPos: currentStartPos,
                endPos: currentStartPos + currentChunk.length
            })

            currentStartPos += currentChunk.length
            currentChunk = ''
            index++
        }

        currentChunk += paragraph + '\n\n'
    }

    // 保存最后一块
    if (currentChunk.trim().length > 0) {
        chunks.push({
            index,
            content: currentChunk.trim(),
            startPos: currentStartPos,
            endPos: currentStartPos + currentChunk.length
        })
    }

    const metadata: TextMetadata = {
        totalLength: text.length,
        totalChunks: chunks.length,
        estimatedChapters: Math.ceil(text.length / AVERAGE_CHAPTER_LENGTH),
        isLongContent: text.length >= LONG_TEXT_THRESHOLD,
        isMegaContent: text.length >= MEGA_TEXT_THRESHOLD
    }

    return { chunks, metadata }
}

// ========== 文件读取 ==========

/**
 * 读取文件内容
 * @param file File 对象
 * @returns 文件文本内容
 */
export async function readFileContent(file: File): Promise<string> {
    // 检查文件类型
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!SUPPORTED_FILE_TYPES.includes(fileExt)) {
        throw new Error(`不支持的文件类型: ${fileExt}。支持的类型: ${SUPPORTED_FILE_TYPES.join(', ')}`)
    }

    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`文件过大: ${formatFileSize(file.size)}。最大支持: ${formatFileSize(MAX_FILE_SIZE)}`)
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = (e) => {
            const content = e.target?.result as string
            resolve(content)
        }

        reader.onerror = () => {
            reject(new Error('文件读取失败'))
        }

        reader.readAsText(file, 'UTF-8')
    })
}

// ========== 格式化工具 ==========

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`
    } else if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`
    } else {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }
}

/**
 * 格式化字数
 */
export function formatWordCount(count: number): string {
    if (count < 10000) {
        return `${count.toLocaleString()} 字`
    } else {
        return `${(count / 10000).toFixed(1)} 万字`
    }
}

/**
 * 估算阅读时间（分钟）
 * 假设阅读速度：300 字/分钟
 */
export function estimateReadingTime(wordCount: number): number {
    const READING_SPEED = 300  // 字/分钟
    return Math.ceil(wordCount / READING_SPEED)
}

// ========== 文本分析 ==========

/**
 * 提取文本摘要（前 N 个字）
 */
export function extractSummary(text: string, maxLength: number = 200): string {
    if (text.length <= maxLength) {
        return text
    }
    return text.slice(0, maxLength) + '...'
}

/**
 * 统计段落数
 */
export function countParagraphs(text: string): number {
    return text.split(/\n\n+/).filter(p => p.trim().length > 0).length
}

/**
 * 统计句子数（简单实现）
 */
export function countSentences(text: string): number {
    return text.split(/[。！？.!?]+/).filter(s => s.trim().length > 0).length
}

/**
 * 计算文本密度（字符/段落）
 */
export function calculateTextDensity(text: string): number {
    const paragraphs = countParagraphs(text)
    if (paragraphs === 0) return 0
    return Math.round(text.length / paragraphs)
}

// ========== 导出 ==========

const chunkerExports = {
    chunkText,
    smartChunkText,
    readFileContent,
    formatFileSize,
    formatWordCount,
    estimateReadingTime,
    extractSummary,
    countParagraphs,
    countSentences,
    calculateTextDensity
}

export default chunkerExports
