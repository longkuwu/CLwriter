/**
 * Plugin Loader - 加载风格胶囊插件
 * 
 * 从 public/plugins/capsules 目录读取 JSON 格式的风格胶囊
 */

export interface RhythmRules {
    chapter_structure?: {
        opening?: string
        development?: string
        climax?: string
        ending?: string
    }
    pacing?: {
        tension_curve?: string
        sentence_rhythm?: string
        scene_switch?: string
        power_growth?: string
        worldbuilding?: string
    }
    dialogue_ratio?: string
    cliffhanger?: string
}

export interface CharacterTemplate {
    archetype: string
    traits: string[]
    growth_arc?: string
    fate?: string
}

export interface StyleCapsule {
    id: string
    name: string
    description: string
    category: string
    author: string
    version: string
    style_prompt: string
    rhythm_rules: RhythmRules
    character_templates?: {
        protagonist?: CharacterTemplate
        antagonist?: CharacterTemplate
        [key: string]: CharacterTemplate | undefined
    }
    sample_prompts?: {
        [key: string]: string
    }
}

// 内置的胶囊列表（用于索引已知的胶囊文件）
const BUILTIN_CAPSULES = [
    'zhihu_revenge',
    'xuanhuan_classic',
]

/**
 * 从 public 目录加载单个风格胶囊
 */
export async function loadCapsule(capsuleId: string): Promise<StyleCapsule> {
    const response = await fetch(`/plugins/capsules/${capsuleId}.json`)

    if (!response.ok) {
        throw new Error(`无法加载风格胶囊: ${capsuleId}`)
    }

    return response.json()
}

/**
 * 加载所有可用的风格胶囊
 */
export async function loadAllCapsules(): Promise<StyleCapsule[]> {
    const capsules: StyleCapsule[] = []

    for (const id of BUILTIN_CAPSULES) {
        try {
            const capsule = await loadCapsule(id)
            capsules.push(capsule)
        } catch (error) {
            console.warn(`加载胶囊失败: ${id}`, error)
        }
    }

    return capsules
}

/**
 * 获取胶囊的简要信息列表（不加载完整内容）
 */
export function getCapsuleList(): Array<{ id: string; name: string; category: string }> {
    return [
        { id: 'zhihu_revenge', name: '知乎复仇文', category: '都市' },
        { id: 'xuanhuan_classic', name: '经典玄幻', category: '玄幻' },
    ]
}

/**
 * 根据分类获取胶囊列表
 */
export function getCapsulesByCategory(category: string): Array<{ id: string; name: string; category: string }> {
    return getCapsuleList().filter(c => c.category === category)
}

/**
 * 获取所有分类
 */
export function getAllCategories(): string[] {
    const categories = new Set(getCapsuleList().map(c => c.category))
    return Array.from(categories)
}
