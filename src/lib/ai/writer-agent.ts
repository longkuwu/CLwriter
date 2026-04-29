/**
 * Writer Agent - 智能熵增写作引擎
 * 
 * 核心功能：
 * 1. 场景分类层 (Scene Classifier)
 * 2. 动态噪音注入 (Dynamic Noise Injection)
 * 3. POV 视点锁定 (Point of View Lock)
 */

import { chatCompletion } from '../tauri-api'

// 场景类型
export type SceneType = 'COMBAT' | 'DAILY' | 'UNKNOWN'

// 写作生成选项
export interface WriterOptions {
    instruction: string
    context: string  // 前文上下文
    characterName: string  // 当前视点人物
    maxTokens?: number
    temperature?: number
}

// 生成结果
export interface WriterResult {
    content: string
    sceneType: SceneType
    success: boolean
    error?: string
}

/**
 * 场景分类 Prompt
 */
const SCENE_CLASSIFIER_PROMPT = `你是一个场景分析器。请快速判断以下写作指令将会产生什么类型的场景。

只输出以下两个标签之一：
- [COMBAT] - 战斗、冲突、逃亡、追逐、危险情况
- [DAILY] - 对话、情感交流、日常活动、思考、回忆

直接输出标签，不要任何解释。`

/**
 * 战斗场景 Prompt
 */
const COMBAT_SCENE_PROMPT = `【战斗场景写作规则 - 肾上腺素模式】

━━━ 感官熵增约束 ━━━
每 200 字必须插入一次由于肾上腺素飙升导致的生理反应。
使用以下关键词库：
- 视觉：视线模糊、瞳孔收缩、血红色边缘、闪烁的残影
- 听觉：耳鸣、心跳如鼓、呼吸如雷、周围声音变远
- 嗅觉：血腥味、焦糊味、汗臭、金属锈味
- 触觉：肌肉撕裂感、关节发烫、麻木、刺痛
- 时间感：时间变慢的错觉、一切都慢了下来、每一秒都被拉长

━━━ 句式约束 ━━━
✅ 多用短句（3-8个字）
✅ 动词主导，减少形容词
✅ 断裂式叙述，模拟紧张心理
❌ 禁止使用长句（超过20字）
❌ 禁止使用"因为...所以..."
❌ 禁止使用"他心想："

━━━ 节奏要求 ━━━
- 开头：直接进入动作，不要铺垫
- 中段：动作-反应-动作，快速切换
- 不要在战斗中停下来解释原理
`

/**
 * 日常场景 Prompt
 */
const DAILY_SCENE_PROMPT = `【日常场景写作规则 - 情绪流动模式】

━━━ 感官熵增约束 ━━━
每 300 字插入一次环境光影或空气流动的描写。
使用以下关键词库：
- 光影：丁达尔效应、斜射的光线、晃动的阴影、窗棂光栅
- 气味：潮湿的霉味、淡淡花香、烟草残余、食物香气
- 声音：远处的车流声、邻居的电视声、时钟滴答、风过缝隙
- 触感：杯壁的温度、椅背的硬度、衣料的质地
- 空气：尘埃浮动、微风轻抚、沉闷压抑、清新流通

━━━ 句式约束 ━━━
✅ 允许长难句，聚焦"情绪的流动"
✅ 描写内心的犹豫、徘徊、纠结
✅ 通过细节暗示情绪，而非直接陈述
❌ 禁止使用逻辑推导式表达
❌ 禁止"因为...所以..."
❌ 禁止直接描写他人内心

━━━ 节奏要求 ━━━
- 可以有留白和停顿
- 对话可以答非所问
- 重要的不是说了什么，而是没说什么
`

/**
 * POV 视点锁定 Prompt
 */
function getPOVLockPrompt(characterName: string): string {
    return `【POV 视点锁定 - 铁律】

你当前的视点人物是：【${characterName}】

🔒 绝对禁止：
- 描写视点人物看不到的东西（背后发生的事）
- 描写其他角色的内心想法（"他心想"）
- 使用上帝视角（"与此同时，在另一边..."）
- 透露视点人物不知道的信息

✅ 只能描写：
- ${characterName} 的眼睛能看到的
- ${characterName} 的耳朵能听到的
- ${characterName} 的身体能感受到的
- ${characterName} 的心理活动（用第三人称）

⚠️ 如果需要暗示他人情绪：
- 通过表情、动作、语气推测
- 使用"似乎"、"仿佛"、"好像"
- 让读者自己判断

例如：
❌ 错误："敌人露出了冷笑" (视点人物背对着)
✅ 正确："背后传来一声轻笑" (只描写听到的)
`
}

/**
 * 分类当前场景
 */
async function classifyScene(instruction: string): Promise<SceneType> {
    try {
        const response = await chatCompletion(
            [
                { role: 'system', content: SCENE_CLASSIFIER_PROMPT },
                { role: 'user', content: instruction }
            ],
            { maxTokens: 20, temperature: 0.1 }
        )

        if (response.includes('[COMBAT]') || response.includes('COMBAT')) {
            return 'COMBAT'
        } else if (response.includes('[DAILY]') || response.includes('DAILY')) {
            return 'DAILY'
        }
        return 'UNKNOWN'

    } catch {
        console.warn('[WriterAgent] 场景分类失败，使用默认')
        return 'UNKNOWN'
    }
}

/**
 * 构建完整的 System Prompt
 */
function buildWriterPrompt(
    sceneType: SceneType,
    characterName: string
): string {
    const povPrompt = getPOVLockPrompt(characterName)

    let scenePrompt = ''
    if (sceneType === 'COMBAT') {
        scenePrompt = COMBAT_SCENE_PROMPT
    } else if (sceneType === 'DAILY') {
        scenePrompt = DAILY_SCENE_PROMPT
    }

    return `你是一个专业的小说作家。请根据以下规则创作内容。

${povPrompt}

${scenePrompt}

【输出要求】
- 直接输出正文，不要任何前缀或解释
- 严格遵守上述规则
- 创作 500-1000 字
`
}

/**
 * 智能熵增写作生成
 */
export async function generateWithSmartEntropy(
    options: WriterOptions
): Promise<WriterResult> {
    const {
        instruction,
        context,
        characterName,
        maxTokens = 2048,
        temperature = 0.75
    } = options

    console.log(`[WriterAgent] 开始智能熵增生成，视点人物: ${characterName}`)

    try {
        // 1. 场景分类
        const sceneType = await classifyScene(instruction)
        console.log(`[WriterAgent] 场景分类: ${sceneType}`)

        // 2. 构建 Prompt
        const systemPrompt = buildWriterPrompt(sceneType, characterName)
        const userPrompt = `${context ? `【前文】\n${context}\n\n` : ''}【写作指令】\n${instruction}`

        // 3. 生成内容
        const content = await chatCompletion(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            { maxTokens, temperature }
        )

        console.log(`[WriterAgent] 生成完成，${content.length} 字`)

        return {
            content,
            sceneType,
            success: true
        }

    } catch (error) {
        console.error('[WriterAgent] 生成失败:', error)
        return {
            content: '',
            sceneType: 'UNKNOWN',
            success: false,
            error: error instanceof Error ? error.message : '未知错误'
        }
    }
}

/**
 * 导出场景规则供外部使用
 */
export const SCENE_RULES = {
    COMBAT: COMBAT_SCENE_PROMPT,
    DAILY: DAILY_SCENE_PROMPT
}
