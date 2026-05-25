"use client"

import { useState, useEffect, useRef } from 'react'
import {
    BookOpen,
    BrainCircuit,
    ZapIcon,
    Target,
    ChevronLeft,
    ChevronRight,
    Heart,
    MapPin,
    Package,
    Sparkles,
    Cpu
} from 'lucide-react'
import { useNovelState } from '@/lib/novel-state'
import { cn } from '@/lib/utils'
import EntitySuggestion from '@/components/editor/EntitySuggestion'
import WorldStatePanel from '@/components/sidebar/WorldStatePanel'
import EnginePanel from '@/components/engine/EnginePanel'

// Codex 状态组件 - 可视化面板
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CodexStatus() {
    const { state } = useNovelState()
    const [flashField, setFlashField] = useState<string | null>(null)
    const prevStateRef = useRef(state)

    // 检测状态变化并触发闪烁动画
    useEffect(() => {
        const prev = prevStateRef.current

        if (prev.hp !== state.hp) {
            setFlashField('hp')
            setTimeout(() => setFlashField(null), 1000)
        } else if (prev.location !== state.location) {
            setFlashField('location')
            setTimeout(() => setFlashField(null), 1000)
        } else if (prev.inventory.length !== state.inventory.length) {
            setFlashField('inventory')
            setTimeout(() => setFlashField(null), 1000)
        }

        prevStateRef.current = state
    }, [state])

    // HP 颜色
    const getHpColor = () => {
        if (state.hp >= 70) return 'bg-green-500'
        if (state.hp >= 40) return 'bg-yellow-500'
        return 'bg-red-500'
    }

    return (
        <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
                <BookOpen className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Codex 状态</h3>
                <Sparkles className="h-3 w-3 text-purple-500 animate-pulse" />
            </div>

            <div className="space-y-4">
                {/* HP 状态条 */}
                <div className={cn(
                    "p-3 rounded-lg bg-accent/30 border transition-all duration-300",
                    flashField === 'hp' ? 'border-red-500 bg-red-500/10 animate-pulse' : 'border-border/50'
                )}>
                    <div className="flex items-center gap-2 mb-2">
                        <Heart className={cn(
                            "h-4 w-4",
                            state.hp < 40 ? 'text-red-500 animate-pulse' : 'text-pink-500'
                        )} />
                        <span className="text-sm font-medium">生命值</span>
                        <span className="ml-auto text-sm font-mono">
                            {state.hp}/100
                        </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                            className={cn("h-full transition-all duration-500", getHpColor())}
                            style={{ width: `${state.hp}%` }}
                        />
                    </div>
                </div>

                {/* 当前位置 */}
                <div className={cn(
                    "p-3 rounded-lg bg-accent/30 border transition-all duration-300",
                    flashField === 'location' ? 'border-blue-500 bg-blue-500/10 animate-pulse' : 'border-border/50'
                )}>
                    <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">当前位置</span>
                    </div>
                    <p className="mt-1 text-sm text-foreground/80 font-medium">
                        {state.location || '未知'}
                    </p>
                </div>

                {/* 物品栏 */}
                <div className={cn(
                    "p-3 rounded-lg bg-accent/30 border transition-all duration-300",
                    flashField === 'inventory' ? 'border-amber-500 bg-amber-500/10 animate-pulse' : 'border-border/50'
                )}>
                    <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium">物品栏</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                            {state.inventory.length} 件
                        </span>
                    </div>
                    {state.inventory.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {state.inventory.map((item, i) => (
                                <span
                                    key={i}
                                    className="px-2 py-0.5 text-xs bg-accent rounded-md border border-border/50"
                                >
                                    {item}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">空空如也</p>
                    )}
                </div>
            </div>

            {/* JSON 调试视图 (折叠) */}
            <details className="mt-3">
                <summary className="text-[10px] text-muted-foreground/50 cursor-pointer hover:text-muted-foreground">
                    查看原始 JSON
                </summary>
                <pre className="mt-2 p-2 bg-muted/30 rounded text-[10px] font-mono overflow-auto max-h-40">
                    {JSON.stringify(state, null, 2)}
                </pre>
            </details>
        </div>
    )
}

// AI 逻辑检查组件
function AILogicChecker() {
    const suggestions = [
        {
            type: 'tip',
            icon: ZapIcon,
            title: '节奏建议',
            desc: '当前章节动作描写较多，可适当增加内心独白'
        },
        {
            type: 'goal',
            icon: Target,
            title: '伏笔提醒',
            desc: '"神秘信物"已埋下3章，建议在近期揭示部分信息'
        },
    ]

    return (
        <div className="p-4 border-t border-border">
            <div className="flex items-center gap-2 mb-4">
                <BrainCircuit className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">AI 逻辑检查</h3>
            </div>
            <div className="space-y-3">
                {suggestions.map((item, index) => (
                    <div
                        key={index}
                        className="p-3 rounded-lg bg-accent/30 border border-border/50 hover:border-border transition-colors cursor-pointer"
                    >
                        <div className="flex items-start gap-2">
                            <item.icon className={cn(
                                "h-4 w-4 mt-0.5 shrink-0",
                                item.type === 'tip' ? 'text-blue-500' : 'text-purple-500'
                            )} />
                            <div>
                                <p className="text-sm font-medium">{item.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

interface RightSidebarProps {
    isCollapsed: boolean
    onToggle: () => void
}

export default function RightSidebar({ isCollapsed, onToggle }: RightSidebarProps) {
    const [view, setView] = useState<'classic' | 'engine'>('engine')

    return (
        <div className="h-full flex flex-col bg-card/50 relative overflow-hidden">
            {/* 折叠按钮 */}
            <button
                onClick={onToggle}
                className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-6 h-12 flex items-center justify-center bg-accent border border-border rounded-l-md hover:bg-accent/80 transition-colors"
            >
                {isCollapsed ? (
                    <ChevronLeft className="h-4 w-4" />
                ) : (
                    <ChevronRight className="h-4 w-4" />
                )}
            </button>

            {!isCollapsed && (
                <>
                    {/* View 切换 */}
                    <div className="flex border-b border-border/30 bg-card">
                        <button
                            onClick={() => setView('engine')}
                            className={cn(
                                'flex-1 py-1.5 text-[11px] flex items-center justify-center gap-1 border-b-2 transition-colors',
                                view === 'engine'
                                    ? 'border-primary text-foreground bg-primary/10'
                                    : 'border-transparent text-muted-foreground hover:bg-accent/30'
                            )}
                        >
                            <Cpu className="h-3 w-3" />
                            状态引擎
                        </button>
                        <button
                            onClick={() => setView('classic')}
                            className={cn(
                                'flex-1 py-1.5 text-[11px] flex items-center justify-center gap-1 border-b-2 transition-colors',
                                view === 'classic'
                                    ? 'border-primary text-foreground bg-primary/10'
                                    : 'border-transparent text-muted-foreground hover:bg-accent/30'
                            )}
                        >
                            <BookOpen className="h-3 w-3" />
                            经典视图
                        </button>
                    </div>

                    {/* 内容区 */}
                    <div className="flex-1 overflow-hidden">
                        {view === 'engine' ? (
                            <EnginePanel />
                        ) : (
                            <div className="p-4 space-y-4 overflow-auto h-full">
                                {/* 🌍 世界状态面板（使用新的 store） */}
                                <WorldStatePanel />

                                {/* 🏛️ 实体建议 */}
                                <EntitySuggestion />

                                {/* 🧠 AI 逻辑检查 */}
                                <AILogicChecker />
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
