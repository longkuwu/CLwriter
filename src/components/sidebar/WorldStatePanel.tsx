"use client"

import { useNovelStore } from '@/lib/store/novel-store'
import { Heart, MapPin, Backpack, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * 世界状态面板 - 右侧边栏 Codex 可视化
 * 
 * 显示：❤️ 生命体征、📍 导航仪、🎒 物品栏、🕐 故事时间
 */
export default function WorldStatePanel() {
    const worldState = useNovelStore((state) => state.worldState)

    // HP 进度条颜色
    const getHpColor = (hp: number) => {
        if (hp > 80) return 'bg-green-500'
        if (hp > 50) return 'bg-yellow-500'
        if (hp > 30) return 'bg-orange-500'
        return 'bg-red-500'
    }

    // HP 背景色
    const getHpBgColor = (hp: number) => {
        if (hp > 80) return 'bg-green-500/10'
        if (hp > 50) return 'bg-yellow-500/10'
        if (hp > 30) return 'bg-orange-500/10'
        return 'bg-red-500/10'
    }

    return (
        <div className="space-y-3">
            {/* ❤️ 生命体征 */}
            <div className={cn(
                "p-3 rounded-lg border transition-all duration-500",
                getHpBgColor(worldState.hp),
                "border-border/50"
            )}>
                <div className="flex items-center gap-2 mb-2">
                    <Heart className={cn(
                        "h-4 w-4 transition-colors",
                        worldState.hp > 50 ? "text-green-500" : "text-red-500",
                        worldState.hp <= 30 && "animate-pulse"
                    )} />
                    <span className="text-xs font-medium text-foreground">生命体征</span>
                    <span className={cn(
                        "ml-auto text-xs font-mono",
                        worldState.hp > 50 ? "text-green-400" : "text-red-400"
                    )}>
                        {worldState.hp}/100
                    </span>
                </div>
                {/* 进度条 */}
                <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                    <div
                        className={cn(
                            "h-full rounded-full transition-all duration-700 ease-out",
                            getHpColor(worldState.hp)
                        )}
                        style={{ width: `${worldState.hp}%` }}
                    />
                </div>
            </div>

            {/* 📍 导航仪 */}
            <div className="p-3 rounded-lg border border-border/50 bg-blue-500/5">
                <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-blue-400" />
                    <span className="text-xs font-medium text-foreground">当前位置</span>
                </div>
                <p className="text-sm text-foreground/90 font-medium">
                    {worldState.location || '未知'}
                </p>
                {/* 小地图占位 */}
                <div className="mt-2 h-16 bg-muted/30 rounded-md flex items-center justify-center border border-dashed border-border/50">
                    <span className="text-[10px] text-muted-foreground">🗺️ 小地图</span>
                </div>
            </div>

            {/* 🎒 物品栏 */}
            <div className="p-3 rounded-lg border border-border/50 bg-amber-500/5">
                <div className="flex items-center gap-2 mb-2">
                    <Backpack className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-medium text-foreground">物品栏</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                        {worldState.items.length}/10
                    </span>
                </div>
                {worldState.items.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                        {worldState.items.map((item, index) => (
                            <span
                                key={index}
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            >
                                {item}
                            </span>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground/60 italic">
                        暂无物品
                    </p>
                )}
            </div>

            {/* 🕐 故事时间 */}
            <div className="p-3 rounded-lg border border-border/50 bg-purple-500/5">
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-purple-400" />
                    <span className="text-xs font-medium text-foreground">故事时间</span>
                </div>
                <p className="text-sm text-foreground/90 mt-1">
                    {worldState.time || '未知'}
                </p>
            </div>
        </div>
    )
}
