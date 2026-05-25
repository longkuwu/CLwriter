/**
 * CHANGES 协议的 System Prompt 注入
 *
 * 必须在每次章节生成时注入,告诉 AI 如何输出结构化变更声明
 */

export const CHANGES_PROTOCOL_PROMPT = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【CHANGES 协议 — 强制输出格式】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

你必须在正文之后,使用 \`---CHANGES---\` 分隔符,输出一段 JSON 描述本章发生的所有状态变化。

输出格式:

正文内容...

---CHANGES---
\`\`\`json
{
  "characterStateChanges": [
    { "characterId": "张三", "realm": "筑基期", "newAbilities": ["御剑术"], "lostAbilities": [], "psychState": "坚定", "keyEvents": ["叛出宗门"], "relationChanges": [{ "targetId": "李四", "trustDelta": -50, "note": "背叛" }] }
  ],
  "conflictProgress": [
    { "conflictId": "正邪大战", "newStatus": "escalated", "progressEvent": "魔教突袭天剑宗" }
  ],
  "newPlotNodes": [
    { "keyword": "叛出宗门", "summary": "张三因师门陷害愤而叛出", "involvedCharacters": ["张三", "李四"], "storyline": "main" }
  ],
  "foreshadowActions": [
    { "foreshadowId": "假死真相", "action": "setup", "note": "暗示张三母亲并未真正死亡" }
  ],
  "locationStateChanges": [
    { "locationId": "天剑宗", "newStatus": "戒备森严", "triggerEvent": "张三叛逃" }
  ],
  "factionStateChanges": [
    { "factionId": "天剑宗", "newStatus": "内乱", "triggerEvent": "首席弟子叛逃" }
  ],
  "timeAdvance": { "currentPeriod": "黄昏", "elapsedTime": "三日", "keyTimeEvents": ["月圆之夜"] },
  "characterMovements": [
    { "characterId": "张三", "fromLocationId": "天剑宗", "toLocationId": "烈焰谷" }
  ],
  "itemTransfers": [
    { "itemName": "天命剑", "fromOwnerId": null, "toOwnerId": "张三", "itemStatus": "active" }
  ],
  "secretReveals": [
    { "secretId": "假死真相", "newKnowerIds": ["张三"], "revealMethod": "母亲托梦" }
  ],
  "oathChanges": [
    { "oathId": "复仇之誓", "action": "create", "relatedCharacters": ["张三", "魔教"], "constraint": "不报此仇誓不罢休", "consequence": "心魔反噬" }
  ],
  "deadlineChanges": [
    { "deadlineId": "七日大劫", "action": "create", "triggerCondition": "月圆之夜", "countdownTo": "七日后" }
  ]
}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【硬性规定】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ⚠️ 12 个字段 **必须全部存在**,即使没有变化也要给空数组 \`[]\` 或 \`null\` (timeAdvance)
2. ⚠️ characterId / locationId / factionId / foreshadowId 等 ID **必须使用已存在实体**,新实体要先在正文里登场
3. ⚠️ 如果本章没有引入任何新角色,characterStateChanges 中只能列出已有角色
4. ⚠️ 不要凭空捏造伏笔 ID,只能用本章实际埋设/回收的伏笔
5. ⚠️ \`---CHANGES---\` 分隔符 **必须独占一行**
6. ⚠️ JSON 必须合法,不要在 JSON 中写注释

【字段说明速查】
- conflictProgress.newStatus: pending(未开始) / active(进行中) / resolved(已解决) / escalated(升级)
- foreshadowActions.action: setup(埋设) / payoff(回收) / reinforce(加强)
- itemTransfers.itemStatus: active / broken / sealed / lost
- oathChanges.action: create / fulfill / break / extend
- newPlotNodes.storyline: main(主线) / side(支线) / background(背景)
`.trim()

/**
 * 在系统提示词中注入 CHANGES 协议
 */
export function injectChangesProtocol(systemPrompt: string): string {
    return `${systemPrompt}\n\n${CHANGES_PROTOCOL_PROMPT}`
}
