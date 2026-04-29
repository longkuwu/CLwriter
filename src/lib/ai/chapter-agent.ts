/**
 * Chapter Agent - 章节代理模块
 * 
 * 实现 Chapter Launch Protocol 的后端逻辑：
 * 1. 上下文组装 (Context Assembly)
 * 2. 细纲规划 (Scene Planning)
 * 3. 正文执笔 (Execution with RAG)
 */

import { chatCompletion } from '../tauri-api'
import { getFileById, getAllFiles, type FileData } from '../actions/files'
import { getRecentChapterSummaries } from './summary'
import { searchMemory } from '../memory'

// ==================== 类型定义 ====================

/**
 * 章节上下文 - Phase 1 输出
 */
export interface ChapterContext {
    currentChapterId: string
    currentChapterTitle: string
    currentChapterOrder: number
    outlineSummary: string      // 本章大纲摘要
    previousChapterText: string // 上一章最后1000字
    recentSummaries: string     // 最近5章梗概
    novelId: string
}

/**
 * 场景定义 - Phase 2 输出
 */
export interface Scene {
    id: string
    location: string       // 地点
    characters: string[]   // 人物
    action: string         // 核心事件
    emotion: string        // 情绪基调
    outcome: string        // 结果/转折
}

/**
 * 场景列表结果
 */
export interface SceneListResult {
    scenes: Scene[]
    success: boolean
    error?: string
}

/**
 * 正文生成结果
 */
export interface SceneContentResult {
    content: string
    success: boolean
    error?: string
}

// ==================== Phase 1: 上下文组装 ====================

/**
 * 准备章节上下文
 * 
 * 获取"承上启下"所需的全部数据：
 * 1. 本章大纲摘要
 * 2. 上一章最后1000字
 * 3. 最近5章梗概
 */
export async function prepareChapterContext(
    chapterId: string
): Promise<ChapterContext | null> {
    console.log(`[ChapterAgent] 📚 开始组装章节上下文: ${chapterId}`)

    try {
        // 1. 获取当前章节信息
        const currentChapter = await getFileById(chapterId)
        if (!currentChapter) {
            console.error('[ChapterAgent] 找不到当前章节')
            return null
        }

        const novelId = currentChapter.novelId || 'default-novel'
        const projectId = currentChapter.projectId
        const currentOrder = currentChapter.order

        // 2. 获取本章大纲摘要
        const outlineSummary = currentChapter.summary || '（暂无大纲摘要）'

        // 3. 获取上一章最后 1000 字
        let previousChapterText = ''

        // 使用 projectId 获取文件（如果没有 projectId，返回空数组）
        let allFiles: Awaited<ReturnType<typeof getAllFiles>> = []
        if (projectId) {
            allFiles = await getAllFiles(projectId)
        }

        const chapterFiles = allFiles
            .filter(f => f.type === 'chapter')
            .sort((a, b) => a.order - b.order)

        const prevChapter = chapterFiles.find(f => f.order === currentOrder - 1)
        if (prevChapter && prevChapter.content) {
            // 取最后 1000 字
            const text = prevChapter.content
            previousChapterText = text.length > 1000
                ? text.slice(-1000)
                : text
        }

        // 4. 获取最近 5 章摘要
        const summaries = await getRecentChapterSummaries(novelId, 5)
        const recentSummaries = summaries.length > 0
            ? summaries.map(s => `【第${s.chapterNumber}章：${s.title}】${s.summary}`).join('\n\n')
            : '（这是第一章，暂无前情）'

        const context: ChapterContext = {
            currentChapterId: chapterId,
            currentChapterTitle: currentChapter.title,
            currentChapterOrder: currentOrder,
            outlineSummary,
            previousChapterText,
            recentSummaries,
            novelId,
        }

        console.log(`[ChapterAgent] ✅ 上下文组装完成:`)
        console.log(`  - 大纲摘要: ${outlineSummary.length} 字`)
        console.log(`  - 上章衔接: ${previousChapterText.length} 字`)
        console.log(`  - 历史摘要: ${summaries.length} 章`)

        return context

    } catch (error) {
        console.error('[ChapterAgent] 上下文组装失败:', error)
        return null
    }
}

// ==================== Phase 2: 细纲规划 ====================

const SCENE_PLANNING_SYSTEM_PROMPT = `你是一个专业的网文大纲策划师。你的任务是将章节拆解为具体的场景细纲。

**输出要求**：
必须输出严格的 JSON 数组，包含 4 个场景对象。
每个场景包含以下字段：
- location: 场景发生地点
- characters: 出场人物数组
- action: 这个场景的核心事件（20-50字）
- emotion: 情绪基调（如：紧张、温馨、悲伤、热血）
- outcome: 场景结果或转折点（20-30字）

**注意**：
1. 只输出 JSON 数组，不要有任何其他文字
2. 场景之间要有递进和呼应
3. 必须遵循本章大纲的核心目标`

/**
 * 生成场景列表
 * 
 * 根据上下文和用户指令，生成 4 个具体场景的细纲
 */
export async function generateSceneList(
    context: ChapterContext,
    userInstruction: string
): Promise<SceneListResult> {
    console.log(`[ChapterAgent] 🎬 开始生成场景细纲...`)

    const userPrompt = `【本章信息】
章节：${context.currentChapterTitle}
大纲摘要：${context.outlineSummary}

【前情提要】
${context.recentSummaries}

【上章结尾】
${context.previousChapterText.slice(-500) || '（本章为开篇）'}

【作者临时指令】
${userInstruction || '（无特殊要求，按大纲执行）'}

请基于以上信息，将本章拆解为 4 个具体场景。输出 JSON 数组。`

    try {
        const response = await chatCompletion(
            [
                { role: 'system', content: SCENE_PLANNING_SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
            ],
            { maxTokens: 2048, temperature: 0.7 }
        )

        // 解析 JSON - 更健壮的处理
        let cleanedResponse = response.trim()

        // 移除可能的 markdown 代码块
        if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.slice(7)
        } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.slice(3)
        }
        if (cleanedResponse.endsWith('```')) {
            cleanedResponse = cleanedResponse.slice(0, -3)
        }
        cleanedResponse = cleanedResponse.trim()

        // 尝试匹配 JSON 数组
        const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/)
        if (!jsonMatch) {
            console.error('[ChapterAgent] 无法解析场景 JSON:', response)
            return {
                scenes: getDefaultScenes(),
                success: false,
                error: 'AI 输出格式错误'
            }
        }

        let rawScenes
        try {
            rawScenes = JSON.parse(jsonMatch[0])
        } catch (parseError) {
            console.error('[ChapterAgent] JSON 解析失败:', parseError)
            return {
                scenes: getDefaultScenes(),
                success: false,
                error: 'JSON 解析失败'
            }
        }

        // 验证是否为数组
        if (!Array.isArray(rawScenes)) {
            console.error('[ChapterAgent] AI 返回的不是数组:', rawScenes)
            return {
                scenes: getDefaultScenes(),
                success: false,
                error: 'AI 输出不是数组'
            }
        }

        // 添加 ID 并验证字段
        const scenes: Scene[] = rawScenes.map((s: Omit<Scene, 'id'>, i: number) => ({
            id: `scene-${i + 1}`,
            location: s.location || '未知地点',
            characters: Array.isArray(s.characters) ? s.characters : [],
            action: s.action || '',
            emotion: s.emotion || '',
            outcome: s.outcome || '',
        }))

        // 确保至少有 2 个有效场景，否则使用默认模板
        if (scenes.length < 2) {
            console.warn(`[ChapterAgent] AI 只生成了 ${scenes.length} 个场景，使用默认模板`)
            return {
                scenes: getDefaultScenes(),
                success: false,
                error: `AI 只生成了 ${scenes.length} 个场景`
            }
        }

        console.log(`[ChapterAgent] ✅ 生成 ${scenes.length} 个场景`)
        return { scenes, success: true }

    } catch (error) {
        console.error('[ChapterAgent] 场景生成失败:', error)
        return {
            scenes: getDefaultScenes(),
            success: false,
            error: error instanceof Error ? error.message : '未知错误'
        }
    }
}

/**
 * 默认场景模板（当 AI 失败时使用）
 */
function getDefaultScenes(): Scene[] {
    return [
        {
            id: 'scene-1',
            location: '场景一地点',
            characters: ['主角'],
            action: '开场：引入本章冲突',
            emotion: '铺垫',
            outcome: '发现问题'
        },
        {
            id: 'scene-2',
            location: '场景二地点',
            characters: ['主角', '配角'],
            action: '发展：矛盾升级',
            emotion: '紧张',
            outcome: '陷入困境'
        },
        {
            id: 'scene-3',
            location: '场景三地点',
            characters: ['主角'],
            action: '转折：找到突破口',
            emotion: '转折',
            outcome: '获得转机'
        },
        {
            id: 'scene-4',
            location: '场景四地点',
            characters: ['主角', '配角'],
            action: '高潮：解决问题或新悬念',
            emotion: '高潮',
            outcome: '本章结束钩子'
        },
    ]
}

// ==================== Phase 4: 正文执笔 ====================

/**
 * 生成单个场景的正文内容
 * 
 * 使用 RAG 检索相关设定，确保不 OOC
 */
export async function writeSceneContent(
    scene: Scene,
    prevText: string,
    context: ChapterContext
): Promise<SceneContentResult> {
    console.log(`[ChapterAgent] ✍️ 开始撰写场景: ${scene.action.slice(0, 20)}...`)

    try {
        // 1. RAG 检索相关设定
        const searchKeywords = `${scene.location} ${scene.characters.join(' ')} ${scene.action}`
        let ragContext = ''

        try {
            const memories = await searchMemory(context.novelId, searchKeywords, 3)
            if (memories.length > 0) {
                ragContext = memories.map((m, i) => `[设定${i + 1}] ${m.content}`).join('\n\n')
            }
        } catch (e) {
            console.warn('[ChapterAgent] RAG 检索失败，继续无设定模式')
        }

        // 2. 构建 System Prompt
        const systemPrompt = `你是一个小说家。请根据场景细纲撰写正文。

${ragContext ? `【RAG 设定检索】\n${ragContext}\n\n` : ''}**任务**：根据细纲场景撰写正文（约 800-1200 字）

**约束**：
1. 紧接上文，严禁重复已写内容
2. 严格遵守 POV 视点锁定，禁止上帝视角
3. 每 300 字插入一次感官细节描写（气味/声音/触觉）
4. 保持人物性格一致，严禁 OOC
5. 保持场景情绪基调：${scene.emotion}`

        // 3. 构建 User Prompt
        const userPrompt = `【上文衔接】
${prevText.slice(-500) || '（本场景为开篇）'}

【场景细纲】
- 地点：${scene.location}
- 人物：${scene.characters.join('、')}
- 核心事件：${scene.action}
- 情绪基调：${scene.emotion}
- 场景结果：${scene.outcome}

请开始撰写这个场景的正文：`

        const content = await chatCompletion(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            { maxTokens: 2048, temperature: 0.8 }
        )

        console.log(`[ChapterAgent] ✅ 场景撰写完成，${content.length} 字`)
        return { content: content.trim(), success: true }

    } catch (error) {
        console.error('[ChapterAgent] 场景撰写失败:', error)
        return {
            content: '',
            success: false,
            error: error instanceof Error ? error.message : '未知错误'
        }
    }
}

/**
 * 批量生成全部场景正文
 * 
 * 按顺序生成每个场景，将上一场景结尾作为下一场景的上文
 */
export async function writeAllScenes(
    scenes: Scene[],
    context: ChapterContext,
    onProgress?: (current: number, total: number) => void
): Promise<string> {
    console.log(`[ChapterAgent] 📝 开始批量生成 ${scenes.length} 个场景...`)

    let fullContent = ''
    let prevText = context.previousChapterText

    for (let i = 0; i < scenes.length; i++) {
        onProgress?.(i + 1, scenes.length)

        const result = await writeSceneContent(scenes[i], prevText, context)

        if (result.success) {
            fullContent += result.content + '\n\n'
            // 更新上文为当前场景结尾
            prevText = result.content.slice(-500)
        } else {
            console.warn(`[ChapterAgent] 场景 ${i + 1} 生成失败，跳过`)
        }
    }

    console.log(`[ChapterAgent] ✅ 全部场景生成完成，共 ${fullContent.length} 字`)
    return fullContent.trim()
}
