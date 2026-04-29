/**
 * Genesis 模块 - 一键创世功能 (重写版)
 * 
 * 基于用户灵感和风格胶囊，使用单次 AI 调用生成：
 * - 世界观
 * - 人物设定  
 * - 10 章大纲（含第一章正文）
 * 
 * 关键：生成后立即写入数据库，而非仅返回内存数据
 */

import { chatCompletion } from '../tauri-api'
import { getDatabase } from '../db'
import { files } from '../db/schema'
import {
    type UserStyle,
    buildStyleSystemPrompt,
    buildFewShotUserPrompt,
    getUserStyleById
} from '../actions/styles'

// 生成进度状态
export type GenesisStep = 'idle' | 'generating' | 'parsing' | 'saving' | 'done' | 'error'

// AI 返回的 JSON 结构
export interface GenesisJSON {
    world_view: string        // 世界观 Markdown
    characters: string        // 人物设定 Markdown
    outline: Array<{
        order: number
        title: string         // 如 "第一章：命运的转折"
        summary: string       // 章节摘要
        content?: string      // 正文（仅第一章有）
    }>
}

// 创世结果
export interface GenesisResult {
    worldView: string
    characters: string
    outline: GenesisJSON['outline']
    firstChapterContent: string
    savedFileIds: string[]
    success: boolean
    error?: string
}

// 创世进度回调
export interface GenesisCallbacks {
    onStepChange: (step: GenesisStep, message: string) => void
    onProgress: (percent: number) => void
}

// System Prompt
const GENESIS_SYSTEM_PROMPT = `你是一个专业的网文创作AI。
请严格按照用户要求的风格和格式输出。
输出必须是纯 JSON，不要包含 Markdown 代码块标记（不要 \`\`\`json）。`

// 创世 Prompt - 要求返回严格 JSON
const buildGenesisPrompt = (idea: string, styleInstruction: string) => `
请根据以下核心创意，生成一部完整小说的基础设定。

【核心创意】
${idea}

【风格要求】
${styleInstruction}

【输出要求】
请返回一个严格的 JSON 对象（不要包含 \`\`\`json 标记），格式如下：

{
  "world_view": "世界观设定，使用 Markdown 格式，包含时空背景、势力分布、力量体系、核心矛盾等。约 500-800 字。",
  
  "characters": "主要人物设定，使用 Markdown 格式。包含主角和 3-5 个重要配角的姓名、身份、性格、与主角关系。约 400-600 字。",
  
  "outline": [
    {
      "order": 1,
      "title": "第一章：[具体标题]",
      "summary": "50-100 字的章节摘要",
      "content": "第一章完整正文，2000-3000 字。注意开局要有冲突，快速吸引读者。"
    },
    {
      "order": 2,
      "title": "第二章：[具体标题]",
      "summary": "章节摘要"
    },
    // ... 共 10 章，只有第一章有 content
  ]
}

【写作约束】
1. 世界观要服务于"${styleInstruction}"风格
2. 如果是爽文，必须有明确的势力鄙视链
3. 第一章正文要快速切入冲突，不要冗长铺垫
4. 对话要简练有力，符合人物性格
5. 大纲节奏：第 1-3 章建立形象，第 4-5 章遇挫折，第 6-10 章逆袭高潮

100. 直接输出 JSON，不要任何其他内容。`

/**
 * 构建带风格的消息数组
 */
function buildGenesisMessages(
    customStyle: UserStyle | null,
    idea: string,
    styleInstruction: string
): Array<{ role: 'system' | 'user'; content: string }> {
    const messages: Array<{ role: 'system' | 'user'; content: string }> = []

    // System Prompt
    let systemContent = GENESIS_SYSTEM_PROMPT
    if (customStyle) {
        systemContent += `\n\n${buildStyleSystemPrompt(customStyle)}`
    }
    messages.push({ role: 'system', content: systemContent })

    // User Prompt with Few-Shot
    let userContent = buildGenesisPrompt(idea, styleInstruction)
    if (customStyle && customStyle.fewShotExamples.length > 0) {
        userContent = buildFewShotUserPrompt(customStyle, userContent)
    }
    messages.push({ role: 'user', content: userContent })

    return messages
}

/**
 * 解析 AI 返回的 JSON（处理可能的格式问题）
 */
function parseGenesisJSON(response: string): GenesisJSON {
    // 移除可能的 Markdown 代码块标记
    let cleaned = response.trim()
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7)
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3)
    }
    if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3)
    }
    cleaned = cleaned.trim()

    // 尝试解析 JSON
    const json = JSON.parse(cleaned) as GenesisJSON

    // 验证必要字段
    if (!json.world_view || typeof json.world_view !== 'string') {
        throw new Error('缺少 world_view 字段')
    }
    if (!json.characters || typeof json.characters !== 'string') {
        throw new Error('缺少 characters 字段')
    }
    if (!Array.isArray(json.outline) || json.outline.length === 0) {
        throw new Error('缺少 outline 数组')
    }

    return json
}

/**
 * 一键创世 - 生成并保存到数据库
 */
export async function generateNovelStructure(
    idea: string,
    stylePrompt: string,
    callbacks: GenesisCallbacks,
    projectId: string, // New parameter
    openingTemplate?: string,
    customStyle?: UserStyle
): Promise<GenesisResult> {
    console.log('[Genesis] 开始创世流程 (Project ID: ' + projectId + ')...')

    const novelId = 'default-novel' // Keep for compatibility
    const savedFileIds: string[] = []

    try {
        // ========== Step 1: AI 生成 ==========
        callbacks.onStepChange('generating', '正在生成世界观、人物和大纲...')
        callbacks.onProgress(10)

        const styleInstruction = customStyle
            ? `${customStyle.name}: ${customStyle.coreInstruction}`
            : stylePrompt

        const messages = buildGenesisMessages(customStyle || null, idea, styleInstruction)

        console.log('[Genesis] 发送创世请求...')
        const response = await chatCompletion(messages, {
            maxTokens: 8192,  // 需要足够的 token 生成第一章
            temperature: 0.8
        })

        callbacks.onProgress(50)

        // ========== Step 2: 解析 JSON ==========
        callbacks.onStepChange('parsing', '正在解析生成内容...')

        let genesisData: GenesisJSON
        try {
            genesisData = parseGenesisJSON(response)
            console.log(`[Genesis] 解析成功: ${genesisData.outline.length} 章大纲`)
        } catch (parseError) {
            console.error('[Genesis] JSON 解析失败:', parseError)
            throw new Error(`JSON 解析失败: ${parseError instanceof Error ? parseError.message : '格式错误'}`)
        }

        callbacks.onProgress(60)

        // ========== Step 3: 写入数据库 (关键!) ==========
        callbacks.onStepChange('saving', '正在保存到数据库...')

        const db = await getDatabase()

        // 3.1 保存世界观
        const worldViewResult = await db.insert(files).values({
            projectId,
            novelId,
            title: '世界观.md',
            type: 'worldview',
            content: genesisData.world_view,
            order: 0,
            summary: '小说世界观设定',
        }).returning()
        if (worldViewResult[0]) savedFileIds.push(worldViewResult[0].id)

        callbacks.onProgress(70)

        // 3.2 保存人物设定
        const charactersResult = await db.insert(files).values({
            projectId,
            novelId,
            title: '人物小传.md',
            type: 'setting',
            content: genesisData.characters,
            order: 1,
            summary: '主要人物设定',
        }).returning()
        if (charactersResult[0]) savedFileIds.push(charactersResult[0].id)

        callbacks.onProgress(75)

        // 3.3 保存大纲 (合并成一个文件)
        const outlineContent = genesisData.outline
            .map(ch => `## ${ch.title}\n\n${ch.summary}`)
            .join('\n\n---\n\n')

        const outlineResult = await db.insert(files).values({
            projectId,
            novelId,
            title: '大纲.md',
            type: 'outline',
            content: outlineContent,
            order: 2,
            summary: `${genesisData.outline.length} 章大纲`,
            metadata: JSON.stringify({ chapters: genesisData.outline.length }),
        }).returning()
        if (outlineResult[0]) savedFileIds.push(outlineResult[0].id)

        callbacks.onProgress(80)

        // 3.4 保存第一章正文
        const firstChapter = genesisData.outline.find(ch => ch.order === 1 && ch.content)
        if (firstChapter?.content) {
            const chapterResult = await db.insert(files).values({
                projectId,
                novelId,
                title: firstChapter.title,
                type: 'chapter',
                content: firstChapter.content,
                order: 10,
                summary: firstChapter.summary,
                metadata: JSON.stringify({ chapterNumber: 1 }),
            }).returning()
            if (chapterResult[0]) savedFileIds.push(chapterResult[0].id)
        }

        callbacks.onProgress(90)

        // 3.5 保存后续章节（仅标题和摘要）
        for (const chapter of genesisData.outline.slice(1)) {
            const chResult = await db.insert(files).values({
                projectId,
                novelId,
                title: chapter.title,
                type: 'chapter',
                content: `# ${chapter.title}\n\n**摘要：** ${chapter.summary}\n\n---\n\n*(待续写...)*`,
                order: 10 + chapter.order,
                summary: chapter.summary,
                metadata: JSON.stringify({ chapterNumber: chapter.order }),
            }).returning()
            if (chResult[0]) savedFileIds.push(chResult[0].id)
        }

        callbacks.onProgress(100)
        callbacks.onStepChange('done', '创世完成！')

        console.log(`[Genesis] 完成！保存了 ${savedFileIds.length} 个文件`)

        return {
            worldView: genesisData.world_view,
            characters: genesisData.characters,
            outline: genesisData.outline,
            firstChapterContent: firstChapter?.content || '',
            savedFileIds,
            success: true
        }

    } catch (error) {
        console.error('[Genesis] 创世失败:', error)
        callbacks.onStepChange('error', error instanceof Error ? error.message : '未知错误')

        return {
            worldView: '',
            characters: '',
            outline: [],
            firstChapterContent: '',
            savedFileIds,
            success: false,
            error: error instanceof Error ? error.message : '未知错误'
        }
    }
}

/**
 * 获取预设风格的写作提示
 */
export function getStylePromptFromCapsule(capsuleId: string): string {
    const stylePrompts: Record<string, string> = {
        'zhihu_revenge': '知乎爽文复仇风格：短句、快节奏、打脸爽点密集、主角装逼打脸、配角震惊脸',
        'xuanhuan_classic': '经典玄幻风格：修炼升级、等级分明、宗门势力、天才与废材对比',
        'test_style': '高爽复仇风格：极端打脸、强烈反差、配角眼镜碎一地',
        'custom': '根据用户自定义风格写作',
    }
    return stylePrompts[capsuleId] || '标准网文风格'
}

/**
 * 根据风格 ID 解析配置
 */
export async function resolveStyleConfig(styleId: string): Promise<{
    stylePrompt: string
    customStyle?: UserStyle
}> {
    // 如果是 UUID 格式（自定义风格）
    if (styleId.length > 20) {
        const customStyle = await getUserStyleById(styleId)
        if (customStyle) {
            return {
                stylePrompt: customStyle.coreInstruction,
                customStyle
            }
        }
    }

    return {
        stylePrompt: getStylePromptFromCapsule(styleId)
    }
}
