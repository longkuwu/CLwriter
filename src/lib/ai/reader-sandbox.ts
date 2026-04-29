/**
 * Reader Sandbox 模块 - 模拟读者试读
 * 
 * 三个特定 Persona Agents：
 * 1. 小白读者 (The Hater) - 找茬喷子
 * 2. 考据党 (The Logician) - 逻辑狂魔 + RAG
 * 3. CP粉 (The Shipper) - 感情进度狂热者
 */

import { chatCompletion } from '../tauri-api'
import { searchMemory } from '../memory'

// 读者类型
export type ReaderType = 'hater' | 'logician' | 'shipper'

// 弹幕评论
export interface ReaderComment {
    type: ReaderType
    avatar: string
    name: string
    comment: string
    tone: 'angry' | 'neutral' | 'happy' | 'confused'
}

// 读者人设
const READER_PERSONAS = {
    hater: {
        name: '小白读者',
        avatar: '😤',
        systemPrompt: `你是一个没耐心的快餐文读者。你的任务是找茬。

【你只关注】
- 爽点是否够快？
- 废话是否太多？
- 是不是在凑字数？
- 主角是否圣母或太弱？

【你的风格】
像网文评论区的喷子，简短犀利，毒舌但有趣。
用完整句子，带有情绪。

【输出示例】
- "看了三章还没进主线，溜了溜了。"
- "这主角太圣母了吧，剧毒！弃了。"
- "废话太多，快进快进！"
- "这节奏就像老牛拉破车，等不下去了。"
- "就这？我追的龙傲天都比这爽！"

请用 1-2 句话吐槽这段内容：`
    },
    logician: {
        name: '考据党',
        avatar: '🧐',
        systemPrompt: `你是一个逻辑狂魔。你的任务是寻找 Bug 和 OOC（人设崩塌）。

【你的检测范围】
- 前后设定矛盾
- 人物行为与性格不符
- 时间线错误
- 地点穿越 Bug
- 能力等级越级

【你的风格】
理智但刻薄，像一个较真的理科生。
引用原文来打脸作者。

【输出示例】
- "第一章说主角是瘸子，这里怎么突然能跳墙了？作者忘了设定？"
- "三天前他还穷得吃不起饭，现在怎么有钱住客栈了？"
- "前面说女主讨厌他，这里怎么主动靠近了？心理描写呢？"
- "逻辑警察出动！这设定前后矛盾了。"

【已知设定参考】
{CODEX_CONTEXT}

请检查以下内容是否有逻辑问题，用 1-2 句话指出：`
    },
    shipper: {
        name: 'CP粉',
        avatar: '💕',
        systemPrompt: `你只关心主角的感情进度。

【你的关注点】
- 主角和谁有互动？
- 有没有发糖？暧昧？牵手？对视？
- 是虐还是甜？
- 互动密度够不够？

【你的风格】
尖叫或失望，像一个追 CP 的疯狂粉丝。
用颜文字和感叹号。

【输出示例】
- "啊啊啊这眼神！！按头小分队来了！锁死！！"
- "磕到了磕到了！！这是什么神仙互动！！"
- "这一章全是打斗，感情戏呢？差评！我要发糖！"
- "虐我可以，别虐他们 QAQ"
- "就这？连个眼神交流都没有？cp粉心碎了..."
- "他俩果然是互相喜欢吧！！救命好甜！！"

请从 CP 视角评价这段内容，用 1-2 句话：`
    }
}

/**
 * 生成读者点评
 * 
 * @param content - 要点评的内容
 * @param novelId - 小说 ID（用于考据党的 RAG 检索）
 */
export async function generateReaderComments(
    content: string,
    novelId?: string
): Promise<ReaderComment[]> {
    console.log('[ReaderSandbox] 开始生成读者点评...')

    const recentContent = content.slice(-2000)  // 取最近 2000 字
    const comments: ReaderComment[] = []

    // 为考据党获取 Codex 上下文
    let codexContext = ''
    if (novelId) {
        try {
            const memories = await searchMemory(novelId, recentContent.slice(0, 200), 3)
            if (memories.length > 0) {
                codexContext = memories.map(m => m.content).join('\n')
            }
        } catch {
            console.warn('[ReaderSandbox] Codex 检索失败')
        }
    }

    // 并发生成三个角色的评论
    const types: ReaderType[] = ['hater', 'logician', 'shipper']

    const promises = types.map(async (type) => {
        const persona = READER_PERSONAS[type]

        // 考据党需要注入 Codex 上下文
        let systemPrompt = persona.systemPrompt
        if (type === 'logician') {
            systemPrompt = systemPrompt.replace(
                '{CODEX_CONTEXT}',
                codexContext || '（暂无历史设定记录）'
            )
        }

        try {
            const response = await chatCompletion(
                [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: recentContent }
                ],
                { maxTokens: 200, temperature: 0.9 }
            )

            // 判断语气
            let tone: ReaderComment['tone'] = 'neutral'
            if (response.includes('！！') || response.includes('啊啊') || response.includes('磕')) {
                tone = 'happy'
            } else if (response.includes('？') && (response.includes('Bug') || response.includes('矛盾'))) {
                tone = 'confused'
            } else if (response.includes('弃') || response.includes('差评') || response.includes('溜')) {
                tone = 'angry'
            }

            return {
                type,
                avatar: persona.avatar,
                name: persona.name,
                comment: response.trim(),
                tone
            }
        } catch (error) {
            console.error(`[ReaderSandbox] ${type} 评论生成失败:`, error)
            return {
                type,
                avatar: persona.avatar,
                name: persona.name,
                comment: '(评论加载失败)',
                tone: 'neutral' as const
            }
        }
    })

    const results = await Promise.all(promises)
    comments.push(...results)

    console.log(`[ReaderSandbox] 生成 ${comments.length} 条评论`)
    return comments
}

/**
 * 生成单个读者点评（用于分开调用）
 */
export async function generateSingleComment(
    type: ReaderType,
    content: string,
    codexContext?: string
): Promise<ReaderComment> {
    const persona = READER_PERSONAS[type]

    let systemPrompt = persona.systemPrompt
    if (type === 'logician' && codexContext) {
        systemPrompt = systemPrompt.replace('{CODEX_CONTEXT}', codexContext)
    }

    try {
        const response = await chatCompletion(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: content.slice(-2000) }
            ],
            { maxTokens: 200, temperature: 0.9 }
        )

        let tone: ReaderComment['tone'] = 'neutral'
        if (response.includes('！！') || response.includes('啊啊')) tone = 'happy'
        else if (response.includes('弃') || response.includes('差评')) tone = 'angry'

        return {
            type,
            avatar: persona.avatar,
            name: persona.name,
            comment: response.trim(),
            tone
        }
    } catch {
        return {
            type,
            avatar: persona.avatar,
            name: persona.name,
            comment: '(评论加载失败)',
            tone: 'neutral'
        }
    }
}
