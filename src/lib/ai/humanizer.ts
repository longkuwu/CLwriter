/**
 * Humanizer 模块 - 工程级去 AI 化
 * 
 * 强制规则：
 * 1. POV 锁定：严禁上帝视角，只能写当前视点人物看到的
 * 2. 熵增注入：每 300 字必须包含一处感官描写（气味/触觉/环境白噪音）
 * 3. 去因果：减少"因为...所以..."句式，增加碎片化情绪描写
 */

// 人类化写作规则
export const HUMANIZER_RULES = `
【核心写作规则 - 必须严格遵守】

1️⃣ POV 锁定 (视点人物)
- 严禁使用上帝视角
- 只能描写视点人物能看到、听到、感受到的
- 禁止描写视点人物不在场景时发生的事
- 禁止直接描写其他角色的内心想法，只能通过外在表现推测

2️⃣ 感官熵增 (每 300 字必须包含)
- 气味描写：焦糊味、花香、腐朽气息、金属锈味...
- 触觉描写：粗糙、滑腻、冰冷、刺痛、麻木...
- 环境音：风声、虫鸣、远处的喧嚣、寂静中的心跳...
- 体感：疲惫、饥饿、口渴、肌肉酸痛...

3️⃣ 去因果碎片化
- 避免"因为A所以B"的直接逻辑表达
- 使用情绪碎片：短促的回忆闪回、未完成的念头
- 多用短句、断句、省略号
- 展示而非解释：用动作和表情代替心理分析

4️⃣ 对话自然化
- 对话中途可以被打断
- 人物可以答非所问
- 避免用对话做信息灌输
- 加入语气词、口癖、犹豫停顿

5️⃣ 禁忌清单 (绝对不能出现)
- ❌ "他心想：" "她暗道："
- ❌ "与此同时，在另一边..."
- ❌ "因为...所以..." "之所以...是因为..."
- ❌ "他感到一股暖流涌上心头"
- ❌ "一阵凉风吹来，仿佛..." 
- ❌ 过度使用"竟然"、"居然"
`

// 生成增强提示
export function getHumanizerSystemPrompt(basePrompt?: string): string {
    const enhancedPrompt = `${basePrompt || ''}

${HUMANIZER_RULES}

【输出要求】
- 直接输出正文内容
- 不要添加任何解释或前言
- 严格遵守上述规则，违反任何一条都是失败的输出
`
    return enhancedPrompt.trim()
}

// 检查文本是否违反规则
export interface HumanizerViolation {
    rule: string
    match: string
    suggestion: string
}

export function checkViolations(text: string): HumanizerViolation[] {
    const violations: HumanizerViolation[] = []

    // 检查上帝视角
    const godViewPatterns = [
        /他心想[：:]/g,
        /她暗道[：:]/g,
        /与此同时.{0,5}在另一边/g,
        /此刻.{0,10}正在/g,
    ]
    for (const pattern of godViewPatterns) {
        const match = text.match(pattern)
        if (match) {
            violations.push({
                rule: 'POV 锁定',
                match: match[0],
                suggestion: '改为通过动作或表情暗示内心'
            })
        }
    }

    // 检查因果句式
    const causalPatterns = [
        /因为.{5,30}所以/g,
        /之所以.{5,30}是因为/g,
    ]
    for (const pattern of causalPatterns) {
        const match = text.match(pattern)
        if (match) {
            violations.push({
                rule: '去因果',
                match: match[0],
                suggestion: '使用碎片化情绪描写替代逻辑解释'
            })
        }
    }

    // 检查套话
    const clichePatterns = [
        /一股暖流涌上心头/g,
        /一阵凉风吹来/g,
        /仿佛有什么东西/g,
        /竟然.{0,10}居然/g,
    ]
    for (const pattern of clichePatterns) {
        const match = text.match(pattern)
        if (match) {
            violations.push({
                rule: '去套话',
                match: match[0],
                suggestion: '使用具体的感官细节替代'
            })
        }
    }

    return violations
}

// 感官词汇库（用于检测是否有足够的感官描写）
export const SENSORY_KEYWORDS = {
    smell: ['味', '香', '臭', '腥', '焦糊', '霉', '烟', '酒气'],
    touch: ['粗糙', '光滑', '冰冷', '温热', '刺痛', '麻', '触感', '握'],
    sound: ['声', '响', '鸣', '嚷', '嘶', '咆哮', '低语', '回荡', '寂静'],
    body: ['疲惫', '饥饿', '口渴', '酸痛', '麻木', '颤抖', '心跳', '呼吸']
}

export function countSensoryWords(text: string): number {
    let count = 0
    const allKeywords = [
        ...SENSORY_KEYWORDS.smell,
        ...SENSORY_KEYWORDS.touch,
        ...SENSORY_KEYWORDS.sound,
        ...SENSORY_KEYWORDS.body
    ]
    for (const keyword of allKeywords) {
        const matches = text.match(new RegExp(keyword, 'g'))
        if (matches) count += matches.length
    }
    return count
}
