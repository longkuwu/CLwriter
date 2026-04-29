"use client"

import { useState } from 'react'
import {
    X,
    Palette,
    Sparkles,
    Save,
    Loader2,
    FileText,
    Lightbulb,
    AlertCircle
} from 'lucide-react'
import { createUserStyle, type FewShotExample } from '@/lib/actions/styles'

interface StyleStudioModalProps {
    isOpen: boolean
    onClose: () => void
    onStyleCreated?: () => void
}

export default function StyleStudioModal({ isOpen, onClose, onStyleCreated }: StyleStudioModalProps) {
    const [styleName, setStyleName] = useState('')
    const [coreInstruction, setCoreInstruction] = useState('')
    const [sample1, setSample1] = useState('')
    const [sample2, setSample2] = useState('')
    const [sample3, setSample3] = useState('')
    const [negativePrompt, setNegativePrompt] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')

    if (!isOpen) return null

    const handleSave = async () => {
        // 验证
        if (!styleName.trim()) {
            setError('请输入风格名称')
            return
        }
        if (!coreInstruction.trim()) {
            setError('请描述核心基调')
            return
        }
        if (!sample1.trim() && !sample2.trim() && !sample3.trim()) {
            setError('请至少提供一个范文样本')
            return
        }

        setIsSaving(true)
        setError('')

        try {
            // 构建 Few-shot 范例
            const fewShotExamples: FewShotExample[] = []
            if (sample1.trim()) {
                fewShotExamples.push({ context: '样本片段 1', example: sample1.trim() })
            }
            if (sample2.trim()) {
                fewShotExamples.push({ context: '样本片段 2', example: sample2.trim() })
            }
            if (sample3.trim()) {
                fewShotExamples.push({ context: '样本片段 3', example: sample3.trim() })
            }

            const result = await createUserStyle({
                name: styleName.trim(),
                coreInstruction: coreInstruction.trim(),
                fewShotExamples,
                negativePrompt: negativePrompt.trim(),
                category: '自定义',
            })

            if (result) {
                alert(`✅ 风格「${styleName}」已保存！\n可在创世引擎和编辑器中使用。`)
                onStyleCreated?.()
                onClose()
                // 重置表单
                setStyleName('')
                setCoreInstruction('')
                setSample1('')
                setSample2('')
                setSample3('')
                setNegativePrompt('')
            } else {
                setError('保存失败，请重试')
            }
        } catch (err) {
            console.error('保存风格失败:', err)
            setError(err instanceof Error ? err.message : '未知错误')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* 背景遮罩 */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* 模态框 */}
            <div className="relative w-full max-w-4xl max-h-[90vh] mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
                {/* 头部 */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-purple-500/10 to-pink-500/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                            <Palette className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">风格工坊 (Style Studio)</h2>
                            <p className="text-xs text-muted-foreground">创建你的专属&quot;伪 LoRA&quot;写作风格</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-accent transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* 内容区 */}
                <div className="p-6 overflow-auto max-h-[calc(90vh-140px)] space-y-6">

                    {/* 基础信息 */}
                    <section className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            基础信息
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">风格名称 *</label>
                                <input
                                    type="text"
                                    value={styleName}
                                    onChange={(e) => setStyleName(e.target.value)}
                                    placeholder="例如：暗黑克苏鲁、甜宠日常、冷硬派侦探..."
                                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">禁止事项 (可选)</label>
                                <input
                                    type="text"
                                    value={negativePrompt}
                                    onChange={(e) => setNegativePrompt(e.target.value)}
                                    placeholder="例如：不要网络用语、不要日式轻小说腔..."
                                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">核心基调 *</label>
                            <textarea
                                value={coreInstruction}
                                onChange={(e) => setCoreInstruction(e.target.value)}
                                placeholder="描述你想要的文风，例如：&#10;'冷硬派侦探风，多用心理独白，少用形容词。句子要短，节奏要快。环境描写要有压迫感，对话要有锋芒。'"
                                className="w-full h-24 px-4 py-3 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                            />
                        </div>
                    </section>

                    {/* Few-Shot 训练区 */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-purple-500" />
                                ✨ 风格投喂 (Few-Shot Learning)
                            </h3>
                        </div>

                        <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                            <div className="flex items-start gap-3">
                                <Lightbulb className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
                                <div className="text-sm text-muted-foreground">
                                    <p className="font-medium text-foreground mb-1">伪 LoRA 原理</p>
                                    <p>请复制粘贴 <strong>3 段该风格的精彩原文</strong>（每段 200 字左右）。</p>
                                    <p className="mt-1">AI 将通过 Few-Shot 学习，模仿这些文字的韵律、用词和节奏。</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* 样本 1 */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs">样本 1</span>
                                    第一段范文
                                </label>
                                <textarea
                                    value={sample1}
                                    onChange={(e) => setSample1(e.target.value)}
                                    placeholder="粘贴你喜欢的文风的一段精彩原文..."
                                    className="w-full h-32 px-4 py-3 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 font-mono"
                                />
                                <p className="text-xs text-muted-foreground text-right">{sample1.length} 字</p>
                            </div>

                            {/* 样本 2 */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 text-xs">样本 2</span>
                                    第二段范文
                                </label>
                                <textarea
                                    value={sample2}
                                    onChange={(e) => setSample2(e.target.value)}
                                    placeholder="粘贴另一段体现该风格的文字..."
                                    className="w-full h-32 px-4 py-3 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono"
                                />
                                <p className="text-xs text-muted-foreground text-right">{sample2.length} 字</p>
                            </div>

                            {/* 样本 3 */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded bg-pink-500/20 text-pink-400 text-xs">样本 3</span>
                                    第三段范文
                                </label>
                                <textarea
                                    value={sample3}
                                    onChange={(e) => setSample3(e.target.value)}
                                    placeholder="粘贴第三段范文，建议选择不同场景..."
                                    className="w-full h-32 px-4 py-3 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-500/50 font-mono"
                                />
                                <p className="text-xs text-muted-foreground text-right">{sample3.length} 字</p>
                            </div>
                        </div>
                    </section>

                    {/* 错误提示 */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                {/* 底部操作栏 */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-accent/30">
                    <p className="text-xs text-muted-foreground">
                        保存后可在「创世引擎」和「编辑器」中选择使用
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                        >
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            <span>{isSaving ? '保存中...' : '保存风格'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
