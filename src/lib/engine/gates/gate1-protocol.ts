/**
 * Gate 1: 协议解析门禁
 *
 * 检查:
 *   - 必须包含 ---CHANGES--- 分隔符
 *   - CHANGES 段必须是合法 JSON
 *   - 12 个字段必须全部存在
 */

import { CHANGES_FIELDS } from '../changes/types'
import type { GateContext, GateResult, GateError } from './types'

export function gate1Protocol(ctx: GateContext): GateResult {
    const errors: GateError[] = []
    const { parsed } = ctx

    // 1. 检查解析错误
    if (parsed.parseError) {
        errors.push({
            code: 'PROTOCOL_PARSE_FAILED',
            message: parsed.parseError
        })
    }

    // 2. 检查 CHANGES 是否存在
    if (!parsed.changes) {
        errors.push({
            code: 'CHANGES_MISSING',
            message: 'CHANGES 段缺失或不可解析'
        })
        return {
            gate: 'gate1_protocol',
            passed: false,
            errors,
            warnings: []
        }
    }

    // 3. 检查 12 个字段是否全部存在
    for (const field of CHANGES_FIELDS) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v = (parsed.changes as any)[field]
        if (field === 'timeAdvance') {
            // timeAdvance 可以是 null 或对象
            if (v !== null && typeof v !== 'object') {
                errors.push({
                    code: 'FIELD_TYPE_INVALID',
                    message: `字段 ${field} 必须是对象或 null`,
                    field
                })
            }
        } else {
            // 其他字段必须是数组 (可以为空)
            if (!Array.isArray(v)) {
                errors.push({
                    code: 'FIELD_TYPE_INVALID',
                    message: `字段 ${field} 必须是数组`,
                    field
                })
            }
        }
    }

    // 4. 检查正文长度
    if (parsed.body.length < 100) {
        errors.push({
            code: 'BODY_TOO_SHORT',
            message: `正文过短 (${parsed.body.length} 字),至少需要 100 字`
        })
    }

    return {
        gate: 'gate1_protocol',
        passed: errors.length === 0,
        errors,
        warnings: []
    }
}
