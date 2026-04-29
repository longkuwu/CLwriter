/**
 * Styles API - 用户自定义风格管理
 * 
 * 提供 CRUD 操作用于管理用户创建的写作风格配置
 */

import { getDatabase } from '../db'
import { userStyles } from '../schema'
import { eq, desc } from 'drizzle-orm'

// Few-shot 范例类型
export interface FewShotExample {
    context: string   // 场景描述，如"战斗场景"、"心理描写"
    example: string   // 范文内容
}

// 用户风格数据类型
export interface UserStyle {
    id: string
    name: string
    coreInstruction: string
    fewShotExamples: FewShotExample[]
    negativePrompt: string
    category: string
    createdAt: Date
    updatedAt: Date
}

// 创建风格输入类型
export interface CreateUserStyleInput {
    name: string
    coreInstruction: string
    fewShotExamples?: FewShotExample[]
    negativePrompt?: string
    category?: string
}

// 更新风格输入类型
export interface UpdateUserStyleInput {
    name?: string
    coreInstruction?: string
    fewShotExamples?: FewShotExample[]
    negativePrompt?: string
    category?: string
}

/**
 * 创建新的用户自定义风格
 */
export async function createUserStyle(input: CreateUserStyleInput): Promise<UserStyle | null> {
    try {
        const db = await getDatabase()

        const result = await db.insert(userStyles).values({
            name: input.name,
            coreInstruction: input.coreInstruction,
            fewShotExamples: input.fewShotExamples || [],
            negativePrompt: input.negativePrompt || '',
            category: input.category || '自定义',
        }).returning()

        if (result.length === 0) return null

        const row = result[0]
        console.log(`[Styles] 创建风格成功: ${row.name}`)

        return {
            id: row.id,
            name: row.name,
            coreInstruction: row.coreInstruction,
            fewShotExamples: (row.fewShotExamples as FewShotExample[]) || [],
            negativePrompt: row.negativePrompt || '',
            category: row.category || '自定义',
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        }
    } catch (error) {
        console.error('[Styles] 创建风格失败:', error)
        return null
    }
}

/**
 * 获取所有用户自定义风格
 */
export async function getUserStyles(): Promise<UserStyle[]> {
    try {
        const db = await getDatabase()

        const results = await db.select()
            .from(userStyles)
            .orderBy(desc(userStyles.updatedAt))

        return results.map(row => ({
            id: row.id,
            name: row.name,
            coreInstruction: row.coreInstruction,
            fewShotExamples: (row.fewShotExamples as FewShotExample[]) || [],
            negativePrompt: row.negativePrompt || '',
            category: row.category || '自定义',
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        }))
    } catch (error) {
        console.error('[Styles] 获取风格列表失败:', error)
        return []
    }
}

/**
 * 根据 ID 获取单个风格
 */
export async function getUserStyleById(id: string): Promise<UserStyle | null> {
    try {
        const db = await getDatabase()

        const results = await db.select()
            .from(userStyles)
            .where(eq(userStyles.id, id))
            .limit(1)

        if (results.length === 0) return null

        const row = results[0]
        return {
            id: row.id,
            name: row.name,
            coreInstruction: row.coreInstruction,
            fewShotExamples: (row.fewShotExamples as FewShotExample[]) || [],
            negativePrompt: row.negativePrompt || '',
            category: row.category || '自定义',
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        }
    } catch (error) {
        console.error('[Styles] 获取风格详情失败:', error)
        return null
    }
}

/**
 * 更新用户风格
 */
export async function updateUserStyle(id: string, input: UpdateUserStyleInput): Promise<boolean> {
    try {
        const db = await getDatabase()

        const updateData: Record<string, unknown> = {
            updatedAt: new Date(),
        }

        if (input.name !== undefined) updateData.name = input.name
        if (input.coreInstruction !== undefined) updateData.coreInstruction = input.coreInstruction
        if (input.fewShotExamples !== undefined) updateData.fewShotExamples = input.fewShotExamples
        if (input.negativePrompt !== undefined) updateData.negativePrompt = input.negativePrompt
        if (input.category !== undefined) updateData.category = input.category

        await db.update(userStyles)
            .set(updateData)
            .where(eq(userStyles.id, id))

        console.log(`[Styles] 更新风格成功: ${id}`)
        return true
    } catch (error) {
        console.error('[Styles] 更新风格失败:', error)
        return false
    }
}

/**
 * 删除用户风格
 */
export async function deleteUserStyle(id: string): Promise<boolean> {
    try {
        const db = await getDatabase()

        await db.delete(userStyles)
            .where(eq(userStyles.id, id))

        console.log(`[Styles] 删除风格成功: ${id}`)
        return true
    } catch (error) {
        console.error('[Styles] 删除风格失败:', error)
        return false
    }
}

/**
 * 构建风格的完整写作提示词（旧版，兼容）
 * 用于注入到 AI 生成的 System Prompt 中
 */
export function buildStylePrompt(style: UserStyle): string {
    let prompt = `【写作风格：${style.name}】\n\n`

    // 核心指令
    prompt += `【核心风格要求】\n${style.coreInstruction}\n\n`

    // Few-shot 范例
    if (style.fewShotExamples.length > 0) {
        prompt += `【参考范文片段】\n`
        style.fewShotExamples.forEach((example, index) => {
            prompt += `[范例${index + 1} - ${example.context}]\n${example.example}\n\n`
        })
    }

    // 反向提示词
    if (style.negativePrompt) {
        prompt += `【禁止事项】\n${style.negativePrompt}\n`
    }

    return prompt
}

/**
 * 构建风格的 System Prompt 注入内容
 * 用于 System 角色消息
 */
export function buildStyleSystemPrompt(style: UserStyle): string {
    let systemPrompt = `[Style Requirement]\n`
    systemPrompt += `You must strictly follow this writing style: "${style.name}"\n\n`
    systemPrompt += `Core Style Instructions:\n${style.coreInstruction}\n`

    if (style.negativePrompt) {
        systemPrompt += `\n[Negative Constraints]\nDo NOT do the following: ${style.negativePrompt}\n`
    }

    return systemPrompt
}

/**
 * 构建 Few-Shot 学习的 User Prompt 前缀
 * 将用户投喂的范文作为学习样本注入
 * 这是模拟 LoRA 效果最经济、最高效的方式
 */
export function buildFewShotUserPrompt(style: UserStyle, taskInstruction: string): string {
    if (style.fewShotExamples.length === 0) {
        return taskInstruction
    }

    let prompt = `[Few-Shot Learning Examples]\n`
    prompt += `Here are ${style.fewShotExamples.length} examples of the desired writing style. `
    prompt += `Mimic the tone, sentence structure, and vocabulary, but write new original content.\n\n`

    style.fewShotExamples.forEach((example, index) => {
        prompt += `--- Example ${index + 1} (${example.context}) ---\n`
        prompt += `${example.example}\n\n`
    })

    prompt += `--- End of Examples ---\n\n`
    prompt += `Now, following the examples above, write the new content:\n\n`
    prompt += taskInstruction

    return prompt
}

/**
 * 构建完整的风格增强消息数组
 * 返回一个可以直接传给 chatCompletion 的消息数组
 */
export function buildStyledMessages(
    style: UserStyle | null,
    baseSystemPrompt: string,
    userInstruction: string
): Array<{ role: 'system' | 'user'; content: string }> {
    const messages: Array<{ role: 'system' | 'user'; content: string }> = []

    // System Prompt
    let systemContent = baseSystemPrompt
    if (style) {
        systemContent += `\n\n${buildStyleSystemPrompt(style)}`
    }
    messages.push({ role: 'system', content: systemContent })

    // User Prompt with Few-Shot
    let userContent = userInstruction
    if (style && style.fewShotExamples.length > 0) {
        userContent = buildFewShotUserPrompt(style, userInstruction)
    }
    messages.push({ role: 'user', content: userContent })

    return messages
}
