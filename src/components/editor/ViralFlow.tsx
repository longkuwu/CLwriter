"use client"

import { useState, useEffect, useRef } from 'react'
import { Zap, Flame, Sparkles, AlertTriangle, Loader2 } from 'lucide-react'
import { chatCompletion } from '@/lib/tauri-api'

interface PredictionCard {
    id: 'slap' | 'twist' | 'crisis'
    icon: React.ReactNode
    label: string
    labelEn: string
    color: string
    prompt: string
}

const PREDICTION_CARDS: PredictionCard[] = [
    {
        id: 'slap',
        icon: <Flame className="h-5 w-5" />,
        label: '打脸',
        labelEn: 'Slap',
        color: 'from-orange-500 to-red-500',
        prompt: '请续写一段"打脸"情节：让主角展示实力，狠狠打脸轻视他的人，让读者爽快。500-800字。'
    },
    {
        id: 'twist',
        icon: <Sparkles className="h-5 w-5" />,
        label: '反转',
        labelEn: 'Twist',
        color: 'from-purple-500 to-blue-500',
        prompt: '请续写一段"反转"情节：出乎意料的剧情转折，让读者惊叹。500-800字。'
    },
    {
        id: 'crisis',
        icon: <AlertTriangle className="h-5 w-5" />,
        label: '危机',
        labelEn: 'Crisis',
        color: 'from-red-500 to-pink-500',
        prompt: '请续写一段"危机"情节：主角陷入危险困境，制造紧张感。500-800字。'
    }
]

interface ViralFlowProps {
    onTextGenerated?: (text: string) => void
    currentContent: string
}

/**
 * 无限续写流 (Infinite Flow)
 * 用户停止打字3秒后，自动弹出预测卡片
 */
export default function ViralFlow({ onTextGenerated, currentContent }: ViralFlowProps) {
    const [showCards, setShowCards] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [selectedCard, setSelectedCard] = useState<string | null>(null)
    const idleTimerRef = useRef<NodeJS.Timeout | null>(null)
    const lastContentRef = useRef(currentContent)

    // 监听内容变化，重置idle计时器
    useEffect(() => {
        // 内容变化时重置计时器
        if (currentContent !== lastContentRef.current) {
            lastContentRef.current = currentContent
            setShowCards(false)  // 隐藏卡片

            // 清除旧计时器
            if (idleTimerRef.current) {
                clearTimeout(idleTimerRef.current)
            }

            // 设置新的3秒计时器
            idleTimerRef.current = setTimeout(() => {
                // 只有内容足够长时才显示卡片
                if (currentContent.length > 100) {
                    setShowCards(true)
                    console.log('[ViralFlow] 检测到3秒空闲，显示预测卡片')
                }
            }, 3000)
        }

        return () => {
            if (idleTimerRef.current) {
                clearTimeout(idleTimerRef.current)
            }
        }
    }, [currentContent])

    // 处理卡片点击
    const handleCardClick = async (card: PredictionCard) => {
        setSelectedCard(card.id)
        setIsGenerating(true)
        setShowCards(false)

        try {
            // 获取最近1000字作为上下文
            const context = currentContent.slice(-1000)

            const systemPrompt = `你是一位擅长网络小说的写手。请直接续写正文，不要加任何标题或前言。
风格要求：节奏紧凑，对话精炼，多用短句，制造爽感。`

            const userPrompt = `【前文】
${context}

【任务】
${card.prompt}

请直接续写正文：`

            const response = await chatCompletion(
                [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                { maxTokens: 1500, temperature: 0.8 }
            )

            if (response && onTextGenerated) {
                onTextGenerated(response)
                console.log(`[ViralFlow] 生成 ${card.label} 内容: ${response.length} 字`)
            }

        } catch (error) {
            console.error('[ViralFlow] 生成失败:', error)
        } finally {
            setIsGenerating(false)
            setSelectedCard(null)
        }
    }

    if (!showCards && !isGenerating) return null

    return (
        <div className="flex justify-center py-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {isGenerating ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-background/90 backdrop-blur-sm rounded-lg border border-border shadow-lg">
                    <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                    <span className="text-sm text-muted-foreground">
                        正在生成 {PREDICTION_CARDS.find(c => c.id === selectedCard)?.label}...
                    </span>
                </div>
            ) : (
                <div className="flex items-center gap-3 p-2 bg-background/90 backdrop-blur-sm rounded-xl border border-border shadow-lg">
                    <Zap className="h-4 w-4 text-orange-500" />
                    <span className="text-xs text-muted-foreground">下一步？</span>

                    {PREDICTION_CARDS.map((card) => (
                        <button
                            key={card.id}
                            onClick={() => handleCardClick(card)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r ${card.color} text-white text-sm font-medium shadow-sm hover:scale-105 transition-transform`}
                        >
                            {card.icon}
                            <span>{card.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
