"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Castle, Flame, Loader2, Sparkles, BookOpen } from 'lucide-react'
import { createProject } from '@/lib/actions/projects'
import { cn } from '@/lib/utils'

// 引擎类型
export type EngineType = 'epic' | 'viral'

interface CreateProjectModalProps {
    isOpen: boolean
    onClose: () => void
}

/**
 * 新建项目模态框
 * 
 * 分流选择：
 * - 🏰 宏大叙事 (Epic) - 长篇、世界观复杂
 * - 🔥 流量爆款 (Viral) - 短篇、爆文仿写
 */
export default function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
    const router = useRouter()
    const [step, setStep] = useState<'select' | 'input'>('select')
    const [selectedEngine, setSelectedEngine] = useState<EngineType | null>(null)
    const [title, setTitle] = useState('')
    const [isCreating, setIsCreating] = useState(false)

    const handleSelectEngine = (engine: EngineType) => {
        setSelectedEngine(engine)
        setStep('input')
    }

    const handleCreate = async () => {
        if (!title.trim() || !selectedEngine) return

        setIsCreating(true)
        try {
            const project = await createProject(title.trim(), selectedEngine)
            if (project) {
                onClose()
                // 根据引擎类型路由到不同页面
                router.push(`/editor/${project.id}`)
            }
        } catch (error) {
            console.error('创建项目失败:', error)
        } finally {
            setIsCreating(false)
        }
    }

    const handleBack = () => {
        setStep('select')
        setSelectedEngine(null)
        setTitle('')
    }

    const handleClose = () => {
        setStep('select')
        setSelectedEngine(null)
        setTitle('')
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* 遮罩 */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* 模态框 */}
            <div className="relative bg-card rounded-2xl shadow-2xl border border-border/50 w-full max-w-2xl mx-4 overflow-hidden animate-in zoom-in-95 fade-in duration-200">
                {/* 关闭按钮 */}
                <button
                    onClick={handleClose}
                    className="absolute right-4 top-4 p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors z-10"
                >
                    <X className="h-5 w-5" />
                </button>

                {step === 'select' ? (
                    /* ========== 第一步：选择引擎类型 ========== */
                    <div className="p-8">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold mb-2">选择创作模式</h2>
                            <p className="text-muted-foreground text-sm">
                                根据你的写作目标，选择合适的引擎
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            {/* 🏰 宏大叙事 */}
                            <button
                                onClick={() => handleSelectEngine('epic')}
                                className="group relative p-6 rounded-xl border-2 border-border/50 bg-gradient-to-br from-purple-500/5 to-indigo-500/10 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all duration-300 text-left"
                            >
                                <div className="absolute top-4 right-4 text-4xl opacity-20 group-hover:opacity-40 transition-opacity">
                                    🏰
                                </div>
                                <div className="mb-4">
                                    <Castle className="h-10 w-10 text-purple-400" />
                                </div>
                                <h3 className="text-lg font-bold mb-2 text-foreground">
                                    宏大叙事
                                </h3>
                                <p className="text-xs text-muted-foreground mb-4">
                                    适合起点/晋江长篇、百万字架构、世界观复杂的作品
                                </p>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-xs text-purple-400">
                                        <Sparkles className="h-3 w-3" />
                                        <span>Codex 7层设定</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-purple-400">
                                        <BookOpen className="h-3 w-3" />
                                        <span>节点导航 + 滚动摘要</span>
                                    </div>
                                </div>
                            </button>

                            {/* 🔥 流量爆款 */}
                            <button
                                onClick={() => handleSelectEngine('viral')}
                                className="group relative p-6 rounded-xl border-2 border-border/50 bg-gradient-to-br from-orange-500/5 to-red-500/10 hover:border-orange-500/50 hover:bg-orange-500/10 transition-all duration-300 text-left"
                            >
                                <div className="absolute top-4 right-4 text-4xl opacity-20 group-hover:opacity-40 transition-opacity">
                                    🔥
                                </div>
                                <div className="mb-4">
                                    <Flame className="h-10 w-10 text-orange-400" />
                                </div>
                                <h3 className="text-lg font-bold mb-2 text-foreground">
                                    流量爆款
                                </h3>
                                <p className="text-xs text-muted-foreground mb-4">
                                    适合知乎/番茄短篇、脑洞文、短剧脚本
                                </p>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-xs text-orange-400">
                                        <Sparkles className="h-3 w-3" />
                                        <span>爆文拆解 + 热点仿写</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-orange-400">
                                        <Flame className="h-3 w-3" />
                                        <span>节奏监控 + 无限续写</span>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                ) : (
                    /* ========== 第二步：输入书名 ========== */
                    <div className="p-8">
                        <div className="text-center mb-6">
                            <div className={cn(
                                "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs mb-4",
                                selectedEngine === 'epic'
                                    ? "bg-purple-500/20 text-purple-400"
                                    : "bg-orange-500/20 text-orange-400"
                            )}>
                                {selectedEngine === 'epic' ? (
                                    <>🏰 宏大叙事模式</>
                                ) : (
                                    <>🔥 流量爆款模式</>
                                )}
                            </div>
                            <h2 className="text-xl font-bold mb-2">为你的作品命名</h2>
                        </div>

                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="输入书名..."
                            autoFocus
                            className="w-full px-4 py-3 text-lg bg-accent/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 mb-6"
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        />

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleBack}
                                className="flex-1 py-3 text-sm text-muted-foreground hover:text-foreground rounded-xl border border-border hover:bg-accent transition-colors"
                            >
                                返回
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!title.trim() || isCreating}
                                className={cn(
                                    "flex-1 py-3 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2",
                                    selectedEngine === 'epic'
                                        ? "bg-purple-600 hover:bg-purple-500 text-white"
                                        : "bg-orange-600 hover:bg-orange-500 text-white",
                                    (!title.trim() || isCreating) && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                {isCreating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        创建中...
                                    </>
                                ) : (
                                    '开始创作'
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
