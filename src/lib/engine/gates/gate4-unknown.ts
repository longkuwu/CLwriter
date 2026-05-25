/**
 * Gate 4: 未知实体检测门禁
 *
 * 检查正文中引入的"未登记实体":
 *   - 总数 > 5 个 → 警告
 *   - 其中"龙套" (无 CHANGES 记录) > 3 个 → 打回
 *
 * 龙套 = 在正文出现但 CHANGES 中没有任何引用的角色
 */

import type { GateContext, GateResult, GateError, GateWarning } from './types'

const UNKNOWN_THRESHOLD = 5    // 未知实体总数阈值
const EXTRA_THRESHOLD = 3      // 龙套阈值

export function gate4Unknown(ctx: GateContext): GateResult {
    const errors: GateError[] = []
    const warnings: GateWarning[] = []
    const { parsed, entities, prevSnapshot } = ctx

    if (!parsed.changes) {
        return { gate: 'gate4_unknown', passed: false, errors: [{ code: 'NO_CHANGES', message: 'CHANGES 不存在' }], warnings }
    }

    const c = parsed.changes
    const body = parsed.body

    // 已登记实体名称集合
    const registered = new Set<string>()
    for (const e of entities) registered.add(e.name)
    if (prevSnapshot) {
        for (const cs of prevSnapshot.characterStates) registered.add(cs.name)
        for (const ls of prevSnapshot.locationStates) registered.add(ls.name)
        for (const fs of prevSnapshot.factionStates) registered.add(fs.name)
    }

    // CHANGES 中引用的实体名称
    const cited = new Set<string>()
    for (const cs of c.characterStateChanges) cited.add(cs.characterId)
    for (const m of c.characterMovements) cited.add(m.characterId)
    for (const ls of c.locationStateChanges) cited.add(ls.locationId)
    for (const fs of c.factionStateChanges) cited.add(fs.factionId)
    for (const cs of c.characterStateChanges) {
        for (const r of cs.relationChanges || []) cited.add(r.targetId)
    }

    // 提取正文中的"专有名词候选" (简化版: 抓 2-4 字汉字组合)
    const namedEntities = extractNamedEntities(body)

    let unknownCount = 0
    let extraCount = 0
    const unknownList: string[] = []
    const extraList: string[] = []

    for (const name of namedEntities) {
        if (!registered.has(name)) {
            unknownCount++
            unknownList.push(name)
            // 在正文出现但 CHANGES 中也未引用 → 龙套
            if (!cited.has(name)) {
                extraCount++
                extraList.push(name)
            }
        }
    }

    if (unknownCount > UNKNOWN_THRESHOLD) {
        warnings.push({
            code: 'TOO_MANY_UNKNOWN',
            message: `本章引入 ${unknownCount} 个未登记实体 (上限 ${UNKNOWN_THRESHOLD}): ${unknownList.slice(0, 10).join(', ')}`
        })
    }

    if (extraCount > EXTRA_THRESHOLD) {
        errors.push({
            code: 'TOO_MANY_EXTRAS',
            message: `本章出现 ${extraCount} 个龙套角色 (上限 ${EXTRA_THRESHOLD}): ${extraList.slice(0, 10).join(', ')}。龙套不应在正文喧宾夺主。`,
            value: extraList
        })
    }

    return {
        gate: 'gate4_unknown',
        passed: errors.length === 0,
        errors,
        warnings
    }
}

/**
 * 简单的命名实体提取 (启发式)
 * 后续可换为 NER 模型
 */
function extractNamedEntities(text: string): string[] {
    // 抓 2-4 字的汉字串,且首字符像姓氏/地点
    const matches = text.match(/[一-龥]{2,4}/g) || []
    const counter = new Map<string, number>()

    // 常见姓氏
    const surnames = new Set('赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳酆鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵堪汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁'.split(''))
    // 地点常见后缀
    const locSuffixes = ['宗', '门', '派', '城', '山', '谷', '林', '阁', '殿', '寺', '庙', '府']

    for (const m of matches) {
        const isPersonName = surnames.has(m[0]) && m.length >= 2 && m.length <= 3
        const isLocation = locSuffixes.some(s => m.endsWith(s))
        if (isPersonName || isLocation) {
            counter.set(m, (counter.get(m) || 0) + 1)
        }
    }

    // 出现 >= 1 次的认为是命名实体
    return Array.from(counter.keys())
}
