/**
 * 用户自定义协议蓝图的本地存储
 *
 * 存储在 localStorage,支持导出/导入 JSON
 */

import type { ProtocolBlueprint } from './types'

const STORAGE_KEY = 'ip_architect_custom_protocols'
const ACTIVE_BLUEPRINT_KEY = 'ip_architect_active_blueprint_id'
const ACTIVE_BASE_URL_KEY = 'ip_architect_active_base_url'
const ACTIVE_API_KEY_KEY = 'ip_architect_active_api_key'
const ACTIVE_MODEL_KEY = 'ip_architect_active_model'

/**
 * 读取所有自定义蓝图
 */
export function getCustomBlueprints(): ProtocolBlueprint[] {
    if (typeof window === 'undefined') return []
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const list = JSON.parse(raw) as ProtocolBlueprint[]
        // 强制 builtIn = false (即使 JSON 文件里写 true)
        return list.map(b => ({ ...b, builtIn: false }))
    } catch (e) {
        console.error('[ProtocolStorage] 读取失败:', e)
        return []
    }
}

/**
 * 保存所有自定义蓝图
 */
export function saveCustomBlueprints(list: ProtocolBlueprint[]): void {
    if (typeof window === 'undefined') return
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    } catch (e) {
        console.error('[ProtocolStorage] 保存失败:', e)
    }
}

/**
 * 添加 / 更新一个自定义蓝图
 */
export function upsertCustomBlueprint(blueprint: ProtocolBlueprint): void {
    const list = getCustomBlueprints()
    const idx = list.findIndex(b => b.id === blueprint.id)
    const final = { ...blueprint, builtIn: false }
    if (idx >= 0) {
        list[idx] = final
    } else {
        list.push(final)
    }
    saveCustomBlueprints(list)
}

/**
 * 删除一个自定义蓝图
 */
export function deleteCustomBlueprint(id: string): void {
    const list = getCustomBlueprints().filter(b => b.id !== id)
    saveCustomBlueprints(list)
}

// ========== 当前激活的配置 ==========

export interface ActiveConfig {
    blueprintId: string
    baseUrl: string
    apiKey: string
    model: string
}

export function getActiveConfig(): ActiveConfig {
    if (typeof window === 'undefined') {
        return { blueprintId: 'openai', baseUrl: '', apiKey: '', model: '' }
    }
    return {
        blueprintId: localStorage.getItem(ACTIVE_BLUEPRINT_KEY) || 'openai',
        baseUrl: localStorage.getItem(ACTIVE_BASE_URL_KEY) || '',
        apiKey: localStorage.getItem(ACTIVE_API_KEY_KEY) || '',
        model: localStorage.getItem(ACTIVE_MODEL_KEY) || ''
    }
}

export function saveActiveConfig(config: Partial<ActiveConfig>): void {
    if (typeof window === 'undefined') return
    if (config.blueprintId !== undefined)
        localStorage.setItem(ACTIVE_BLUEPRINT_KEY, config.blueprintId)
    if (config.baseUrl !== undefined)
        localStorage.setItem(ACTIVE_BASE_URL_KEY, config.baseUrl)
    if (config.apiKey !== undefined)
        localStorage.setItem(ACTIVE_API_KEY_KEY, config.apiKey)
    if (config.model !== undefined)
        localStorage.setItem(ACTIVE_MODEL_KEY, config.model)
}

// ========== 导出 / 导入 ==========

/**
 * 导出蓝图为 JSON 字符串 (可分享)
 */
export function exportBlueprint(blueprint: ProtocolBlueprint): string {
    return JSON.stringify(blueprint, null, 2)
}

/**
 * 导出多个蓝图为 JSON
 */
export function exportBlueprints(list: ProtocolBlueprint[]): string {
    return JSON.stringify({ version: 1, blueprints: list }, null, 2)
}

/**
 * 从 JSON 导入蓝图
 *
 * 支持两种格式:
 *   - 单个蓝图: { id, name, ... }
 *   - 蓝图集合: { version: 1, blueprints: [...] }
 */
export function importBlueprints(jsonText: string): {
    success: boolean
    blueprints: ProtocolBlueprint[]
    error?: string
} {
    try {
        const data = JSON.parse(jsonText)
        let list: ProtocolBlueprint[]

        if (Array.isArray(data)) {
            list = data
        } else if (data.blueprints && Array.isArray(data.blueprints)) {
            list = data.blueprints
        } else if (data.id && data.name) {
            list = [data as ProtocolBlueprint]
        } else {
            return { success: false, blueprints: [], error: '无法识别 JSON 格式' }
        }

        // 验证并规范化
        const validated: ProtocolBlueprint[] = []
        for (const b of list) {
            if (!b.id || !b.name || !b.chatEndpoint || !b.auth) {
                continue
            }
            validated.push({ ...b, builtIn: false })
        }

        if (validated.length === 0) {
            return { success: false, blueprints: [], error: '没有有效的蓝图' }
        }

        return { success: true, blueprints: validated }
    } catch (e) {
        return {
            success: false,
            blueprints: [],
            error: e instanceof Error ? e.message : 'JSON 解析失败'
        }
    }
}

/**
 * 生成新蓝图的默认 ID
 */
export function generateBlueprintId(name: string): string {
    const slug = name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 30)
    return `custom-${slug || 'unnamed'}-${Date.now().toString(36).slice(-4)}`
}
