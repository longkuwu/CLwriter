/**
 * Chunker - 长文本切分工具
 * 
 * 智能切分长文本，保持章节完整性
 * 支持 10万字+ 超长文本处理
 */

export interface ChunkResult {
    chunks: TextChunk[]
    metadata: TextMetadata
}

export interface TextChunk {
    index: number
    content: string
    wordCount: number
    title?: string  // 章节标题（如果检测到）
}

export interface TextMetadata {
    totalWordCount: number
    totalChunks: number
    estimatedChapters: number
    averageChunkSize: number
    isLongContent: boolean  // > 20000 字
}

// 章节标题正则（支持多种格式）
const CHAPTER_PATTERNS = [
    /^第[一二三四五六七八九十百千\d]+章\s*.*/gm,          // 第X章
    /^第[一二三四五六七八九十百千\d]+节\s*.*/gm,          // 第X节
    /^Chapter\s*\d+/gim,                                  // Chapter X
    /^[【\[]\d+[】\]]/gm,                                  // 【1】 或 [1]
    /^Part\s*\d+/gim,                                      // Part X
    /^\d+[\.、]\s*.+/gm,                                   // 1. 或 1、
]

// 分段符号
const PARAGRAPH_SEPARATORS = ['\n\n', '\r\n\r\n', '\n', '\r\n']

/**
 * 智能切分长文本
 * 
 * @param text 原始文本
 * @param targetChunkSize 目标块大小（字符数）
 * @returns 切分结果
 */
export function chunkText(
    text: string,
    targetChunkSize: number = 4000
): ChunkResult {
    const totalWordCount = text.length
    const isLongContent = totalWordCount > 20000

    // 短文本直接返回
    if (totalWordCount <= targetChunkSize) {
        return {
            chunks: [{
                index: 0,
                content: text,
                wordCount: totalWordCount
            }],
            metadata: {
                totalWordCount,
                totalChunks: 1,
                estimatedChapters: estimateChapterCount(text),
                averageChunkSize: totalWordCount,
                isLongContent
            }
        }
    }

    // 尝试按章节切分
    const chapters = splitByChapters(text)

    if (chapters.length > 1) {
        // 有章节结构，按章节分块
        const chunks = mergeChaptersToChunks(chapters, targetChunkSize)
        return {
            chunks,
            metadata: {
                totalWordCount,
                totalChunks: chunks.length,
                estimatedChapters: chapters.length,
                averageChunkSize: Math.round(totalWordCount / chunks.length),
                isLongContent
            }
        }
    }

    // 无章节结构，按段落切分
    const paragraphs = splitByParagraphs(text)
    const chunks = mergeParagraphsToChunks(paragraphs, targetChunkSize)

    return {
        chunks,
        metadata: {
            totalWordCount,
            totalChunks: chunks.length,
            estimatedChapters: 1,
            averageChunkSize: Math.round(totalWordCount / chunks.length),
            isLongContent
        }
    }
}

/**
 * 按章节切分
 */
function splitByChapters(text: string): string[] {
    // 合并所有章节模式
    let allMatches: { index: number; match: string }[] = []

    for (const pattern of CHAPTER_PATTERNS) {
        const regex = new RegExp(pattern.source, pattern.flags)
        let match
        while ((match = regex.exec(text)) !== null) {
            allMatches.push({ index: match.index, match: match[0] })
        }
    }

    if (allMatches.length === 0) {
        return [text]
    }

    // 按位置排序
    allMatches.sort((a, b) => a.index - b.index)

    // 去重（相同位置的匹配只保留一个）
    allMatches = allMatches.filter((item, index, arr) =>
        index === 0 || item.index !== arr[index - 1].index
    )

    // 切分
    const chapters: string[] = []
    for (let i = 0; i < allMatches.length; i++) {
        const start = allMatches[i].index
        const end = i + 1 < allMatches.length ? allMatches[i + 1].index : text.length
        const chapter = text.slice(start, end).trim()
        if (chapter.length > 0) {
            chapters.push(chapter)
        }
    }

    // 如果第一个章节标题不在开头，保留开头部分
    if (allMatches.length > 0 && allMatches[0].index > 100) {
        const prologue = text.slice(0, allMatches[0].index).trim()
        if (prologue.length > 100) {
            chapters.unshift(prologue)
        }
    }

    return chapters
}

/**
 * 按段落切分
 */
function splitByParagraphs(text: string): string[] {
    for (const separator of PARAGRAPH_SEPARATORS) {
        const parts = text.split(separator).filter(p => p.trim().length > 0)
        if (parts.length > 1) {
            return parts
        }
    }
    return [text]
}

/**
 * 合并章节为块（保持单章完整性）
 */
function mergeChaptersToChunks(
    chapters: string[],
    targetSize: number
): TextChunk[] {
    const chunks: TextChunk[] = []
    let currentContent = ''
    let chunkIndex = 0

    for (const chapter of chapters) {
        if (chapter.length > targetSize) {
            // 单章太长，需要进一步切分
            if (currentContent.length > 0) {
                chunks.push({
                    index: chunkIndex++,
                    content: currentContent.trim(),
                    wordCount: currentContent.length,
                    title: extractChapterTitle(currentContent)
                })
                currentContent = ''
            }

            // 按段落切分长章节
            const paragraphs = splitByParagraphs(chapter)
            const subChunks = mergeParagraphsToChunks(paragraphs, targetSize)
            for (const subChunk of subChunks) {
                subChunk.index = chunkIndex++
                chunks.push(subChunk)
            }
        } else if (currentContent.length + chapter.length > targetSize) {
            // 当前块已满，开始新块
            if (currentContent.length > 0) {
                chunks.push({
                    index: chunkIndex++,
                    content: currentContent.trim(),
                    wordCount: currentContent.length,
                    title: extractChapterTitle(currentContent)
                })
            }
            currentContent = chapter
        } else {
            // 继续累积
            currentContent += '\n\n' + chapter
        }
    }

    // 处理剩余内容
    if (currentContent.trim().length > 0) {
        chunks.push({
            index: chunkIndex,
            content: currentContent.trim(),
            wordCount: currentContent.length,
            title: extractChapterTitle(currentContent)
        })
    }

    return chunks
}

/**
 * 合并段落为块
 */
function mergeParagraphsToChunks(
    paragraphs: string[],
    targetSize: number
): TextChunk[] {
    const chunks: TextChunk[] = []
    let currentContent = ''
    let chunkIndex = 0

    for (const paragraph of paragraphs) {
        if (currentContent.length + paragraph.length > targetSize) {
            if (currentContent.length > 0) {
                chunks.push({
                    index: chunkIndex++,
                    content: currentContent.trim(),
                    wordCount: currentContent.length
                })
            }
            currentContent = paragraph
        } else {
            currentContent += '\n\n' + paragraph
        }
    }

    if (currentContent.trim().length > 0) {
        chunks.push({
            index: chunkIndex,
            content: currentContent.trim(),
            wordCount: currentContent.length
        })
    }

    return chunks
}

/**
 * 提取章节标题
 */
function extractChapterTitle(content: string): string | undefined {
    const firstLine = content.split('\n')[0].trim()
    for (const pattern of CHAPTER_PATTERNS) {
        if (pattern.test(firstLine)) {
            return firstLine.slice(0, 50)
        }
    }
    return undefined
}

/**
 * 估算章节数
 */
function estimateChapterCount(text: string): number {
    let count = 0
    for (const pattern of CHAPTER_PATTERNS) {
        const matches = text.match(new RegExp(pattern.source, pattern.flags))
        if (matches) {
            count = Math.max(count, matches.length)
        }
    }
    return Math.max(1, count)
}

/**
 * 读取上传文件内容
 */
export async function readFileContent(file: File): Promise<string> {
    const extension = file.name.split('.').pop()?.toLowerCase()

    switch (extension) {
        case 'txt':
        case 'md':
            return await file.text()

        case 'docx':
            // TODO: 需要额外库支持
            throw new Error('DOCX 文件支持即将推出')

        case 'epub':
            // TODO: 需要额外库支持
            throw new Error('EPUB 文件支持即将推出')

        default:
            throw new Error(`不支持的文件格式: ${extension}`)
    }
}

/**
 * 格式化字数显示
 */
export function formatWordCount(count: number): string {
    if (count >= 10000) {
        return `${(count / 10000).toFixed(1)} 万字`
    }
    return `${count} 字`
}
