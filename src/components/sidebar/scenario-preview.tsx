"use client"

import { Zap, Flame, Waves, Sparkles } from 'lucide-react'
import { useNovelStore, type Prediction, type PredictionType } from '@/lib/store/novel-store'

// 根据类型获取样式配置
const typeConfig: Record<PredictionType, {
    label: string
    emoji: string
    icon: typeof Flame
    borderColor: string
    bgColor: string
    textColor: string
    tagBg: string
}> = {
    aggressive: {
        label: '激进',
        emoji: '🔥',
        icon: Flame,
        borderColor: 'border-red-500/50',
        bgColor: 'hover:bg-red-500/10',
        textColor: 'text-red-400',
        tagBg: 'bg-red-500/20',
    },
    balanced: {
        label: '稳健',
        emoji: '🌊',
        icon: Waves,
        borderColor: 'border-blue-500/50',
        bgColor: 'hover:bg-blue-500/10',
        textColor: 'text-blue-400',
        tagBg: 'bg-blue-500/20',
    },
    surprise: {
        label: '意外',
        emoji: '⚡',
        icon: Zap,
        borderColor: 'border-purple-500/50',
        bgColor: 'hover:bg-purple-500/10',
        textColor: 'text-purple-400',
        tagBg: 'bg-purple-500/20',
    },
}

// 预测卡片组件
function PredictionCard({ prediction }: { prediction: Prediction }) {
    const applyPrediction = useNovelStore((state) => state.applyPrediction)
    const config = typeConfig[prediction.type]
    const Icon = config.icon

    const handleClick = () => {
        applyPrediction(prediction)
    }

    return (
        <button
            onClick={handleClick}
            className={`w-full text-left p-3 rounded-lg bg-card/60 border ${config.borderColor} ${config.bgColor} transition-all group`}
        >
            <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">{config.emoji}</span>
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${config.tagBg} ${config.textColor}`}>
                    {config.label}
                </span>
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
                {prediction.title}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
                {prediction.description}
            </p>
            <div className="mt-2 text-[10px] text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                点击应用灵感 →
            </div>
        </button>
    )
}

// 空状态组件
function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-purple-400" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
                点击编辑器底部的<br />
                <span className="text-purple-400 font-medium">✨ 卡文了？帮我想想</span><br />
                按钮，AI 为你构思走向。
            </p>
        </div>
    )
}

// 主组件
export default function ScenarioPreview() {
    const predictions = useNovelStore((state) => state.predictions)

    return (
        <div className="p-4 space-y-3">
            {/* 标题 */}
            <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                <h3 className="font-semibold">剧情预演</h3>
            </div>

            <p className="text-xs text-muted-foreground">
                AI 预测的可能发展方向，点击可应用到编辑器
            </p>

            {/* 预测卡片或空状态 */}
            {predictions.length > 0 ? (
                <div className="space-y-2">
                    {predictions.map((pred, index) => (
                        <PredictionCard key={index} prediction={pred} />
                    ))}
                </div>
            ) : (
                <EmptyState />
            )}
        </div>
    )
}
