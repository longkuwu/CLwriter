"use client"

import { useState, useEffect, useMemo } from 'react'
import { AlertTriangle, Zap, TrendingUp, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import { quickPacingCheck, getRandomSuggestion } from '@/lib/ai/rhythm-agent'

interface RhythmMonitorProps {
    content: string
}

// 关键词分类（保留用于快速检测）
const CONFLICT_KEYWORDS = [
    '打脸', '狂喷', '暴怒', '震惊', '崩溃', '反击', '爆发', '暴走',
    '杀', '死', '血', '怒', '恨', '吼', '骂', '打',
    '竟然', '居然', '没想到', '不可能', '疯了', '完了',
    '危机', '危险', '陷阱', '阴谋', '背叛', '秘密'
]

const EMOTIONAL_KEYWORDS = [
    '爱', '恨', '喜', '悲', '怒', '惧', '惊', '羡',
    '哭', '笑', '泪', '痛', '甜', '苦', '酸'
]

/**
 * 节奏监控器 (Rhythm Monitor)
 * 实时分析最近1000字的情绪密度
 */
export default function RhythmMonitor({ content }: RhythmMonitorProps) {
    const [showWarning, setShowWarning] = useState(false)
    const [warningMessage, setWarningMessage] = useState('')
    const [suggestions, setSuggestions] = useState<string[]>([])

    // 分析最近1000字
    const analysis = useMemo(() => {
        const recentText = content.slice(-1000)

        // 计算冲突关键词密度
        let conflictCount = 0
        for (const keyword of CONFLICT_KEYWORDS) {
            const matches = recentText.match(new RegExp(keyword, 'g'))
            conflictCount += matches ? matches.length : 0
        }

        // 计算情绪关键词密度
        let emotionCount = 0
        for (const keyword of EMOTIONAL_KEYWORDS) {
            const matches = recentText.match(new RegExp(keyword, 'g'))
            emotionCount += matches ? matches.length : 0
        }

        // 使用 rhythm-agent 的快速检测
        const agentCheck = quickPacingCheck(recentText)

        // 计算总密度分数 (0-100)
        const totalKeywords = conflictCount + emotionCount
        const density = Math.min(100, Math.round((totalKeywords / recentText.length) * 1000))

        // 状态判断（结合 agent 结果）
        let status: 'hot' | 'warm' | 'cold'
        if (density >= 15 || conflictCount >= 5) {
            status = 'hot'
        } else if (density >= 5 || conflictCount >= 2) {
            status = 'warm'
        } else {
            status = 'cold'
        }

        return {
            density,
            conflictCount,
            emotionCount,
            status,
            textLength: recentText.length,
            agentStatus: agentCheck.status
        }
    }, [content])

    // 检测平淡警告
    useEffect(() => {
        // 超过800字没有足够的冲突/情绪
        if (analysis.textLength >= 800 && analysis.status === 'cold') {
            setShowWarning(true)
            setWarningMessage('⚠️ 警报：已 800+ 字无有效冲突！')
            setSuggestions([
                getRandomSuggestion(),
                getRandomSuggestion(),
                getRandomSuggestion()
            ])
        } else {
            setShowWarning(false)
        }
    }, [analysis])

    // 进度条颜色
    const getBarColor = () => {
        switch (analysis.status) {
            case 'hot': return 'bg-gradient-to-t from-green-500 to-emerald-400'
            case 'warm': return 'bg-gradient-to-t from-yellow-500 to-amber-400'
            case 'cold': return 'bg-gradient-to-t from-red-500 to-rose-400'
        }
    }

    // 进度条高度
    const barHeight = Math.max(10, Math.min(100, analysis.density * 3))

    return (
        <>
            {/* 右侧垂直进度条 */}
            <div className="fixed right-2 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-2">
                {/* 图标 */}
                <div className={cn(
                    "p-1.5 rounded-full transition-all",
                    analysis.status === 'hot' && "bg-green-500/20 text-green-500",
                    analysis.status === 'warm' && "bg-yellow-500/20 text-yellow-500",
                    analysis.status === 'cold' && "bg-red-500/20 text-red-500 animate-pulse"
                )}>
                    {analysis.status === 'hot' ? (
                        <TrendingUp className="h-4 w-4" />
                    ) : analysis.status === 'cold' ? (
                        <AlertTriangle className="h-4 w-4" />
                    ) : (
                        <Zap className="h-4 w-4" />
                    )}
                </div>

                {/* 进度条容器 */}
                <div className="relative w-3 h-32 bg-muted/50 rounded-full overflow-hidden border border-border/50">
                    {/* 进度条填充 */}
                    <div
                        className={cn(
                            "absolute bottom-0 left-0 right-0 rounded-full transition-all duration-500",
                            getBarColor(),
                            analysis.status === 'cold' && "animate-pulse"
                        )}
                        style={{ height: `${barHeight}%` }}
                    />
                </div>

                {/* 密度数值 */}
                <span className={cn(
                    "text-xs font-mono",
                    analysis.status === 'hot' && "text-green-500",
                    analysis.status === 'warm' && "text-yellow-500",
                    analysis.status === 'cold' && "text-red-500"
                )}>
                    {analysis.density}
                </span>
            </div>

            {/* 警告弹窗 */}
            {showWarning && (
                <div className="fixed right-16 top-1/2 -translate-y-1/2 z-50 animate-in slide-in-from-right-5">
                    <div className="bg-red-950/90 border border-red-500/50 rounded-lg p-4 max-w-xs shadow-lg backdrop-blur-sm">
                        <div className="flex items-start gap-2 mb-3">
                            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-red-200">{warningMessage}</p>
                            </div>
                        </div>

                        {/* 建议列表 */}
                        <div className="space-y-1.5 mb-3">
                            <p className="text-xs text-red-300/60 flex items-center gap-1">
                                <Lightbulb className="h-3 w-3" />
                                建议：
                            </p>
                            {suggestions.map((suggestion, i) => (
                                <p key={i} className="text-xs text-red-300/80 pl-4">
                                    {i + 1}. {suggestion}
                                </p>
                            ))}
                        </div>

                        <button
                            onClick={() => setShowWarning(false)}
                            className="w-full text-xs text-red-300 hover:text-red-100 transition-colors border border-red-500/30 rounded py-1.5 hover:bg-red-500/20"
                        >
                            知道了
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}
