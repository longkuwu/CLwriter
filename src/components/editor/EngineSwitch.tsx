"use client"

import { Zap, BookOpen } from 'lucide-react'
import { useNovelStore } from '@/lib/store/novel-store'
import { cn } from '@/lib/utils'

/**
 * 引擎切换开关
 * [宏大叙事 (Epic)] / [流量爆款 (Viral)]
 */
export default function EngineSwitch() {
    const writingMode = useNovelStore((state) => state.writingMode)
    const setWritingMode = useNovelStore((state) => state.setWritingMode)

    return (
        <div className="flex items-center gap-1 p-1 bg-background/50 backdrop-blur-sm rounded-lg border border-border/50">
            {/* Epic Mode */}
            <button
                onClick={() => setWritingMode('epic')}
                className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                    writingMode === 'epic'
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
                title="宏大叙事模式：结构化写作，侧重大纲和世界观"
            >
                <BookOpen className="h-4 w-4" />
                <span>宏大叙事</span>
            </button>

            {/* Viral Mode */}
            <button
                onClick={() => setWritingMode('viral')}
                className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                    writingMode === 'viral'
                        ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
                title="流量爆款模式：快节奏写作，自动预测爆点"
            >
                <Zap className="h-4 w-4" />
                <span>流量爆款</span>
            </button>
        </div>
    )
}
