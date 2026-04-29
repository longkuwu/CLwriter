"use client"

import { useState } from 'react'
import { Users, Loader2, X, RefreshCw } from 'lucide-react'
import { generateReaderComments, type ReaderComment } from '@/lib/ai/reader-sandbox'
import { useNovelStore } from '@/lib/store/novel-store'
import { cn } from '@/lib/utils'

/**
 * 模拟读者试读面板（右侧滑出）
 */
export default function ReaderSandbox() {
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [comments, setComments] = useState<ReaderComment[]>([])

    const storeContent = useNovelStore((state) => state.currentContent)
    const currentNovelId = useNovelStore((state) => state.currentNovelId)

    const handleGenerateComments = async () => {
        setIsLoading(true)
        setIsOpen(true)

        try {
            const results = await generateReaderComments(storeContent, currentNovelId)
            setComments(results)
        } catch (error) {
            console.error('[ReaderSandbox] 生成失败:', error)
            setComments([{
                type: 'hater',
                avatar: '❌',
                name: '系统',
                comment: '评论生成失败，请稍后重试',
                tone: 'neutral'
            }])
        } finally {
            setIsLoading(false)
        }
    }

    const getToneStyle = (tone: ReaderComment['tone']) => {
        switch (tone) {
            case 'angry': return 'border-red-500/30 bg-red-500/10'
            case 'happy': return 'border-pink-500/30 bg-pink-500/10'
            case 'confused': return 'border-yellow-500/30 bg-yellow-500/10'
            default: return 'border-border/50 bg-accent/30'
        }
    }

    const getTypeColor = (type: ReaderComment['type']) => {
        switch (type) {
            case 'hater': return 'text-red-400'
            case 'logician': return 'text-blue-400'
            case 'shipper': return 'text-pink-400'
        }
    }

    return (
        <>
            {/* 触发按钮（放在编辑器顶部） */}
            <button
                onClick={handleGenerateComments}
                disabled={isLoading || !storeContent}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-600/80 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <Users className="h-3.5 w-3.5" />
                )}
                <span>投放试读</span>
            </button>

            {/* 右侧滑出面板 */}
            {isOpen && (
                <>
                    {/* 遮罩 */}
                    <div
                        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* 面板 */}
                    <div className="fixed right-0 top-0 bottom-0 z-50 w-96 bg-card border-l border-border shadow-2xl animate-in slide-in-from-right">
                        {/* 标题栏 */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-accent/30">
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-purple-500" />
                                <h3 className="font-semibold">评论区模拟器</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleGenerateComments}
                                    disabled={isLoading}
                                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors disabled:opacity-50"
                                    title="重新生成"
                                >
                                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* 评论列表 */}
                        <div className="p-4 space-y-4 overflow-auto h-[calc(100vh-60px)]">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3">
                                    <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                                    <p className="text-sm text-muted-foreground">读者们正在疯狂吐槽...</p>
                                </div>
                            ) : comments.length > 0 ? (
                                comments.map((comment, index) => (
                                    <div
                                        key={index}
                                        className={cn(
                                            "p-4 rounded-lg border transition-all animate-in slide-in-from-right",
                                            getToneStyle(comment.tone)
                                        )}
                                        style={{ animationDelay: `${index * 150}ms` }}
                                    >
                                        {/* 头像和名称 */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-2xl">{comment.avatar}</span>
                                            <div>
                                                <span className={cn("text-sm font-medium", getTypeColor(comment.type))}>
                                                    {comment.name}
                                                </span>
                                                <span className="text-xs text-muted-foreground ml-2">
                                                    {comment.type === 'hater' && '快餐读者'}
                                                    {comment.type === 'logician' && '逻辑狂魔'}
                                                    {comment.type === 'shipper' && 'CP粉'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* 评论内容 */}
                                        <p className="text-sm leading-relaxed text-foreground/90">
                                            {comment.comment}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12">
                                    <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                                    <p className="text-sm text-muted-foreground">
                                        点击"投放试读"获取读者反馈
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* 底部说明 */}
                        <div className="absolute bottom-0 left-0 right-0 px-4 py-2 border-t border-border bg-card/80 backdrop-blur-sm">
                            <p className="text-xs text-muted-foreground text-center">
                                模拟读者视角，仅供参考 · 点击面板外关闭
                            </p>
                        </div>
                    </div>
                </>
            )}
        </>
    )
}
