"use client"

import { useState } from 'react'
import { Bookmark, CheckCircle2, X, Loader2 } from 'lucide-react'
import { useNovelStore } from '@/lib/store/novel-store'
import { archiveEntityToCodex, type DiscoveredEntity } from '@/lib/analysis/entity'
import { cn } from '@/lib/utils'

/**
 * 实体归档建议面板（内联版）
 * 集成在右侧栏，显示新发现的实体
 */
export default function EntitySuggestion() {
    const discoveredEntities = useNovelStore((state) => state.discoveredEntities)
    const clearDiscoveredEntities = useNovelStore((state) => state.clearDiscoveredEntities)
    const currentNovelId = useNovelStore((state) => state.currentNovelId)

    const [archiving, setArchiving] = useState<string | null>(null)
    const [archived, setArchived] = useState<Set<string>>(new Set())

    // 没有发现实体时不渲染
    if (discoveredEntities.length === 0) return null

    const handleArchive = async (entity: typeof discoveredEntities[0]) => {
        setArchiving(entity.name)

        try {
            const success = await archiveEntityToCodex(currentNovelId, {
                name: entity.name,
                type: entity.type as DiscoveredEntity['type'],
                count: entity.count,
                context: entity.context,
                isNew: true
            })

            if (success) {
                setArchived(prev => new Set([...Array.from(prev), entity.name]))
            }
        } catch (error) {
            console.error('[EntitySuggestion] 归档失败:', error)
        } finally {
            setArchiving(null)
        }
    }

    const handleDismiss = () => {
        clearDiscoveredEntities()
        setArchived(new Set())
    }

    const getTypeEmoji = (type: string) => {
        const emojis: Record<string, string> = {
            character: '👤',
            location: '📍',
            item: '⚔️',
            skill: '✨',
            event: '📜'
        }
        return emojis[type] || '📝'
    }

    return (
        <div className="p-4 border-t border-border">
            {/* 标题 */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Bookmark className="h-4 w-4 text-emerald-500" />
                    <h3 className="text-sm font-semibold">发现新设定</h3>
                </div>
                <button
                    onClick={handleDismiss}
                    className="text-muted-foreground/60 hover:text-foreground transition-colors"
                    title="关闭"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* 实体列表 */}
            <div className="space-y-2">
                {discoveredEntities.map((entity) => {
                    const isArchived = archived.has(entity.name)
                    const isArchiving = archiving === entity.name

                    return (
                        <div
                            key={entity.name}
                            className={cn(
                                "flex items-center justify-between p-2.5 rounded-lg border transition-all",
                                isArchived
                                    ? "bg-emerald-500/10 border-emerald-500/30"
                                    : "bg-accent/30 border-border/50 hover:border-emerald-500/30"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-base">{getTypeEmoji(entity.type)}</span>
                                <div>
                                    <p className="text-sm font-medium">{entity.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        出现 {entity.count} 次
                                    </p>
                                </div>
                            </div>

                            {isArchived ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                                <button
                                    onClick={() => handleArchive(entity)}
                                    disabled={isArchiving}
                                    className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors disabled:opacity-50"
                                >
                                    {isArchiving ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        '归档'
                                    )}
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>

            <p className="text-xs text-muted-foreground/60 mt-2">
                归档后可在 Codex 中管理
            </p>
        </div>
    )
}
