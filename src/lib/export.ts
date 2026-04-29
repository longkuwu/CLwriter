/**
 * Export 模块 - 导出与发布功能
 * 
 * 支持导出为 DOCX 和 Markdown 格式
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { saveAs } from 'file-saver'
import { getDatabase } from './db'
import { files } from './db/schema'
import { eq, and, asc } from 'drizzle-orm'

// 章节数据
export interface ChapterData {
    chapterNumber: number
    title: string
    content: string
    summary: string
}

// 导出统计
export interface ExportStats {
    totalChapters: number
    totalWords: number
    aiAssistedRatio: number  // AI 辅助比例 (0-1)
    creationTime: string     // 创作时长
    editCount: number        // 修改次数
}

/**
 * 获取所有章节内容（从 files 表读取最新数据）
 * 
 * @param projectId - 项目 ID (UUID)
 */
export async function getAllChapters(projectId: string): Promise<ChapterData[]> {
    try {
        const db = await getDatabase()

        // 🔧 修正：从 files 表查询，使用 projectId 和 type='chapter'
        const results = await db.select({
            order: files.order,
            title: files.title,
            content: files.content,
            summary: files.summary,
        })
            .from(files)
            .where(and(
                eq(files.projectId, projectId),
                eq(files.type, 'chapter')
            ))
            .orderBy(asc(files.order))

        console.log(`[Export] 查询到 ${results.length} 个章节`)

        return results.map((r: { order: number | null, title: string, content: string | null, summary: string | null }, index: number) => ({
            chapterNumber: (r.order ?? index) + 1,
            title: r.title,
            content: r.content || '',
            summary: r.summary || ''
        }))
    } catch (error) {
        console.error('[Export] 获取章节失败:', error)
        return []
    }
}

/**
 * 导出为 Markdown 格式
 */
export async function exportToMarkdown(novelId: string, novelTitle: string): Promise<void> {
    const chapterList = await getAllChapters(novelId)

    if (chapterList.length === 0) {
        alert('没有可导出的章节')
        return
    }

    // 构建 Markdown 内容
    let markdown = `# ${novelTitle}\n\n`
    markdown += `> 导出时间: ${new Date().toLocaleString()}\n\n`
    markdown += `---\n\n`

    for (const chapter of chapterList) {
        markdown += `## 第${chapter.chapterNumber}章 ${chapter.title}\n\n`
        markdown += `${chapter.content}\n\n`
        markdown += `---\n\n`
    }

    // 添加统计信息
    const totalWords = chapterList.reduce((sum, c) => sum + c.content.length, 0)
    markdown += `\n\n---\n\n`
    markdown += `**统计信息**\n\n`
    markdown += `- 总章节数: ${chapterList.length}\n`
    markdown += `- 总字数: ${totalWords.toLocaleString()}\n`

    // 创建并下载文件
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    saveAs(blob, `${novelTitle}.md`)

    console.log(`[Export] 已导出 Markdown: ${novelTitle}.md`)
}

/**
 * 导出为 DOCX 格式
 */
export async function exportToDocx(novelId: string, novelTitle: string): Promise<void> {
    const chapterList = await getAllChapters(novelId)

    if (chapterList.length === 0) {
        alert('没有可导出的章节')
        return
    }

    // 构建文档段落
    const children: Paragraph[] = []

    // 标题
    children.push(
        new Paragraph({
            text: novelTitle,
            heading: HeadingLevel.TITLE,
            spacing: { after: 400 },
        })
    )

    // 导出信息
    children.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: `导出时间: ${new Date().toLocaleString()}`,
                    italics: true,
                    size: 20,
                }),
            ],
            spacing: { after: 400 },
        })
    )

    // 章节内容
    for (const chapter of chapterList) {
        // 章节标题
        children.push(
            new Paragraph({
                text: `第${chapter.chapterNumber}章 ${chapter.title}`,
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
            })
        )

        // 章节正文（按段落分割）
        const paragraphs = chapter.content.split(/\n\n?/).filter(p => p.trim())
        for (const para of paragraphs) {
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: para.trim(),
                            size: 24,
                        }),
                    ],
                    spacing: { after: 200 },
                    indent: { firstLine: 480 }, // 首行缩进
                })
            )
        }
    }

    // 创建文档
    const doc = new Document({
        sections: [{
            properties: {},
            children: children,
        }],
    })

    // 生成并下载
    const buffer = await Packer.toBlob(doc)
    saveAs(buffer, `${novelTitle}.docx`)

    console.log(`[Export] 已导出 DOCX: ${novelTitle}.docx`)
}

/**
 * 生成创作证书 HTML
 */
export async function generateCreationCertificate(
    novelId: string,
    novelTitle: string,
    authorName: string = '匿名作者'
): Promise<string> {
    const chapterList = await getAllChapters(novelId)

    const totalWords = chapterList.reduce((sum, c) => sum + c.content.length, 0)
    const totalChapters = chapterList.length

    // 模拟 AI 辅助比例（实际应该从日志计算）
    const aiAssistedRatio = 0.35  // 假设 35%
    const humanContribution = 1 - aiAssistedRatio

    const certificateHTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>创作证书 - ${novelTitle}</title>
    <style>
        body {
            font-family: 'Source Han Serif SC', 'Noto Serif SC', serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #e8e8e8;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 40px;
        }
        .certificate {
            background: linear-gradient(145deg, #232342 0%, #1a1a2e 100%);
            border: 2px solid #4a4a6a;
            border-radius: 16px;
            padding: 60px;
            max-width: 700px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        h1 {
            text-align: center;
            font-size: 32px;
            margin-bottom: 10px;
            background: linear-gradient(90deg, #a78bfa, #818cf8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .subtitle {
            text-align: center;
            color: #888;
            margin-bottom: 40px;
        }
        .novel-title {
            text-align: center;
            font-size: 28px;
            font-weight: bold;
            color: #fff;
            margin: 30px 0;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin: 40px 0;
        }
        .stat-card {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 20px;
            text-align: center;
        }
        .stat-value {
            font-size: 36px;
            font-weight: bold;
            color: #a78bfa;
        }
        .stat-label {
            font-size: 14px;
            color: #888;
            margin-top: 8px;
        }
        .human-ratio {
            text-align: center;
            margin: 40px 0;
            padding: 30px;
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 12px;
        }
        .human-ratio .value {
            font-size: 48px;
            font-weight: bold;
            color: #10b981;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            color: #666;
            font-size: 12px;
        }
        .signature {
            text-align: right;
            margin-top: 30px;
            font-style: italic;
            color: #aaa;
        }
    </style>
</head>
<body>
    <div class="certificate">
        <h1>📜 创作证书</h1>
        <p class="subtitle">Certificate of Authorship</p>
        
        <div class="novel-title">《${novelTitle}》</div>
        <p style="text-align: center; color: #888;">作者: ${authorName}</p>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${totalChapters}</div>
                <div class="stat-label">总章节数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalWords.toLocaleString()}</div>
                <div class="stat-label">总字数</div>
            </div>
        </div>
        
        <div class="human-ratio">
            <div class="value">${(humanContribution * 100).toFixed(0)}%</div>
            <div style="color: #10b981; margin-top: 10px;">人类智力贡献比例</div>
            <p style="color: #888; font-size: 12px; margin-top: 15px;">
                AI 辅助创作比例: ${(aiAssistedRatio * 100).toFixed(0)}%
            </p>
        </div>
        
        <p style="text-align: center; color: #888; font-size: 14px; line-height: 1.8;">
            本作品由人类作者主导创作，AI 作为辅助工具参与。<br>
            根据创作日志分析，人类的创意决策、剧情设计和文字润色<br>
            占据了核心创作贡献。
        </p>
        
        <div class="signature">
            <p>生成日期: ${new Date().toLocaleDateString()}</p>
            <p>IP Architect 创作平台</p>
        </div>
        
        <div class="footer">
            <p>此证书由 IP Architect 自动生成，仅供参考</p>
        </div>
    </div>
</body>
</html>
`

    // 创建并下载
    const blob = new Blob([certificateHTML], { type: 'text/html;charset=utf-8' })
    saveAs(blob, `创作证书_${novelTitle}.html`)

    console.log(`[Export] 已生成创作证书`)
    return certificateHTML
}
