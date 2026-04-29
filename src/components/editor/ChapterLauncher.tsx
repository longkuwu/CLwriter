"use client"

import { useState, useEffect } from 'react'
import {
    Sparkles,
    Loader2,
    GripVertical,
    MapPin,
    Users,
    Zap,
    Heart,
    Target,
    Play,
    Edit3,
    Check,
    X,
    ChevronDown,
    ChevronUp,
    BookOpen
} from 'lucide-react'
import {
    prepareChapterContext,
    generateSceneList,
    writeAllScenes,
    type ChapterContext,
    type Scene
} from '@/lib/ai/chapter-agent'

interface ChapterLauncherProps {
    chapterId: string
    chapterTitle: string
    onComplete: (content: string) => void
    onCancel?: () => void
}

// 场景卡片组件
function SceneCard({
    scene,
    index,
    isEditing,
    onEdit,
    onSave,
    onCancel,
    editValue,
    onEditChange,
}: {
    scene: Scene
    index: number
    isEditing: boolean
    onEdit: () => void
    onSave: () => void
    onCancel: () => void
    editValue: string
    onEditChange: (value: string) => void
}) {
    const emotionColors: Record<string, string> = {
        '紧张': 'border-red-500/50 bg-red-500/5',
        '温馨': 'border-pink-500/50 bg-pink-500/5',
        '悲伤': 'border-blue-500/50 bg-blue-500/5',
        '热血': 'border-orange-500/50 bg-orange-500/5',
        '转折': 'border-purple-500/50 bg-purple-500/5',
        '高潮': 'border-yellow-500/50 bg-yellow-500/5',
        '铺垫': 'border-gray-500/50 bg-gray-500/5',
    }

    const cardClass = emotionColors[scene.emotion] || 'border-border/50 bg-card/50'

    return (
        <div className={`relative p-4 rounded-xl border-2 ${cardClass} transition-all hover:shadow-lg group`}>
            {/* 拖拽手柄 */}
            <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-30 group-hover:opacity-100 cursor-grab">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>

            {/* 场景编号 */}
            <div className="absolute -left-3 -top-3 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shadow-lg">
                {index + 1}
            </div>

            <div className="ml-6 space-y-3">
                {/* 地点和人物 */}
                <div className="flex flex-wrap gap-2 text-xs">
                    <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-accent/50">
                        <MapPin className="h-3 w-3" />
                        {scene.location}
                    </span>
                    <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-accent/50">
                        <Users className="h-3 w-3" />
                        {scene.characters.join('、')}
                    </span>
                    <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">
                        <Heart className="h-3 w-3" />
                        {scene.emotion}
                    </span>
                </div>

                {/* 核心事件 */}
                {isEditing ? (
                    <div className="space-y-2">
                        <textarea
                            value={editValue}
                            onChange={(e) => onEditChange(e.target.value)}
                            className="w-full h-20 px-3 py-2 text-sm rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={onSave}
                                className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30"
                            >
                                <Check className="h-3 w-3" />
                                保存
                            </button>
                            <button
                                onClick={onCancel}
                                className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
                            >
                                <X className="h-3 w-3" />
                                取消
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="relative group/action">
                        <p className="text-sm font-medium flex items-start gap-2">
                            <Zap className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                            {scene.action}
                        </p>
                        <button
                            onClick={onEdit}
                            className="absolute right-0 top-0 opacity-0 group-hover/action:opacity-100 p-1 rounded hover:bg-accent/50"
                        >
                            <Edit3 className="h-3 w-3 text-muted-foreground" />
                        </button>
                    </div>
                )}

                {/* 结果 */}
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    结果：{scene.outcome}
                </p>
            </div>
        </div>
    )
}

export default function ChapterLauncher({
    chapterId,
    chapterTitle,
    onComplete,
    onCancel,
}: ChapterLauncherProps) {
    // 状态
    const [phase, setPhase] = useState<'input' | 'planning' | 'preview' | 'generating'>('input')
    const [context, setContext] = useState<ChapterContext | null>(null)
    const [scenes, setScenes] = useState<Scene[]>([])
    const [userInstruction, setUserInstruction] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [editingScene, setEditingScene] = useState<string | null>(null)
    const [editValue, setEditValue] = useState('')
    const [generateProgress, setGenerateProgress] = useState({ current: 0, total: 0 })
    const [showContext, setShowContext] = useState(false)

    // 初始化：加载上下文
    useEffect(() => {
        async function loadContext() {
            const ctx = await prepareChapterContext(chapterId)
            if (ctx) {
                setContext(ctx)
            } else {
                setError('无法加载章节上下文')
            }
        }
        loadContext()
    }, [chapterId])

    // 生成场景细纲
    const handleGenerateScenes = async () => {
        if (!context) return

        setPhase('planning')
        setIsLoading(true)
        setError('')

        try {
            const result = await generateSceneList(context, userInstruction)
            setScenes(result.scenes)
            setPhase('preview')

            if (!result.success) {
                setError('AI 生成异常，已使用默认模板')
            }
        } catch {
            setError('场景生成失败')
            setPhase('input')
        } finally {
            setIsLoading(false)
        }
    }

    // 生成正文
    const handleGenerateContent = async () => {
        if (!context || scenes.length === 0) return

        setPhase('generating')
        setIsLoading(true)
        setError('')

        try {
            const content = await writeAllScenes(
                scenes,
                context,
                (current, total) => setGenerateProgress({ current, total })
            )
            onComplete(content)
        } catch {
            setError('正文生成失败')
            setPhase('preview')
        } finally {
            setIsLoading(false)
        }
    }

    // 编辑场景
    const handleEditScene = (sceneId: string) => {
        const scene = scenes.find(s => s.id === sceneId)
        if (scene) {
            setEditingScene(sceneId)
            setEditValue(scene.action)
        }
    }

    const handleSaveEdit = () => {
        if (!editingScene) return
        setScenes(prev => prev.map(s =>
            s.id === editingScene ? { ...s, action: editValue } : s
        ))
        setEditingScene(null)
        setEditValue('')
    }

    const handleCancelEdit = () => {
        setEditingScene(null)
        setEditValue('')
    }

    // 移动场景（简单上下移动）
    const moveScene = (index: number, direction: 'up' | 'down') => {
        const newScenes = [...scenes]
        const targetIndex = direction === 'up' ? index - 1 : index + 1
        if (targetIndex < 0 || targetIndex >= scenes.length) return

        [newScenes[index], newScenes[targetIndex]] = [newScenes[targetIndex], newScenes[index]]
        setScenes(newScenes)
    }

    return (
        <div className="h-full flex flex-col bg-gradient-to-b from-background to-accent/10 p-8">
            <div className="max-w-3xl mx-auto w-full space-y-6">
                {/* 标题 */}
                <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-2">
                        <BookOpen className="h-8 w-8 text-purple-500" />
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-indigo-500 bg-clip-text text-transparent">
                            章节启动器
                        </h1>
                    </div>
                    <p className="text-lg text-foreground">{chapterTitle}</p>
                    <p className="text-sm text-muted-foreground">
                        {phase === 'input' && '请输入本章的创作想法，AI 将为你规划场景细纲'}
                        {phase === 'planning' && '正在规划场景细纲...'}
                        {phase === 'preview' && '请确认或调整场景安排，然后生成正文'}
                        {phase === 'generating' && `正在生成正文... 场景 ${generateProgress.current}/${generateProgress.total}`}
                    </p>
                </div>

                {/* 错误提示 */}
                {error && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                        ⚠️ {error}
                    </div>
                )}

                {/* Phase 1: 输入阶段 */}
                {phase === 'input' && context && (
                    <div className="space-y-4">
                        {/* 上下文预览 */}
                        <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
                            <button
                                onClick={() => setShowContext(!showContext)}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30"
                            >
                                <span className="font-medium text-sm">📖 本章大纲摘要</span>
                                {showContext ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                            {showContext && (
                                <div className="px-4 pb-4 space-y-3">
                                    <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                                        <p className="text-sm">{context.outlineSummary}</p>
                                    </div>
                                    {context.previousChapterText && (
                                        <div className="text-xs text-muted-foreground">
                                            <p className="font-medium mb-1">上章结尾预览：</p>
                                            <p className="line-clamp-3">{context.previousChapterText.slice(-200)}...</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 用户想法输入 */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">
                                ✨ 本章特殊想法（可选）
                            </label>
                            <textarea
                                value={userInstruction}
                                onChange={(e) => setUserInstruction(e.target.value)}
                                placeholder="例如：想加点感情戏、让反派提前露面、这章节奏快一点..."
                                className="w-full h-24 px-4 py-3 text-sm rounded-xl border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 placeholder:text-muted-foreground/50"
                            />
                        </div>

                        {/* 生成按钮 */}
                        <button
                            onClick={handleGenerateScenes}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/20"
                        >
                            {isLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <Sparkles className="h-5 w-5" />
                            )}
                            <span>生成场景细纲</span>
                        </button>
                    </div>
                )}

                {/* Phase 2: 规划中 */}
                {phase === 'planning' && (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                        <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
                        <p className="text-muted-foreground">AI 正在规划场景...</p>
                    </div>
                )}

                {/* Phase 3: 预览场景 */}
                {phase === 'preview' && (
                    <div className="space-y-4">
                        {/* 场景卡片列表 */}
                        <div className="space-y-4">
                            {scenes.map((scene, index) => (
                                <div key={scene.id} className="relative">
                                    <SceneCard
                                        scene={scene}
                                        index={index}
                                        isEditing={editingScene === scene.id}
                                        onEdit={() => handleEditScene(scene.id)}
                                        onSave={handleSaveEdit}
                                        onCancel={handleCancelEdit}
                                        editValue={editValue}
                                        onEditChange={setEditValue}
                                    />
                                    {/* 移动按钮 */}
                                    <div className="absolute -right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1">
                                        <button
                                            onClick={() => moveScene(index, 'up')}
                                            disabled={index === 0}
                                            className="p-1 rounded bg-accent/50 hover:bg-accent disabled:opacity-30"
                                        >
                                            <ChevronUp className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => moveScene(index, 'down')}
                                            disabled={index === scenes.length - 1}
                                            className="p-1 rounded bg-accent/50 hover:bg-accent disabled:opacity-30"
                                        >
                                            <ChevronDown className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setPhase('input')}
                                className="flex-1 px-4 py-3 rounded-xl border border-border text-muted-foreground hover:bg-accent/50 transition-all"
                            >
                                ← 返回修改
                            </button>
                            <button
                                onClick={handleGenerateContent}
                                disabled={isLoading}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium hover:opacity-90 disabled:opacity-50 transition-all shadow-lg"
                            >
                                <Play className="h-5 w-5" />
                                <span>一键生成正文</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Phase 4: 生成中 */}
                {phase === 'generating' && (
                    <div className="space-y-6 py-8">
                        <div className="flex flex-col items-center space-y-4">
                            <Loader2 className="h-12 w-12 animate-spin text-green-500" />
                            <p className="text-lg font-medium">正在撰写正文...</p>
                            <p className="text-muted-foreground">
                                场景 {generateProgress.current} / {generateProgress.total}
                            </p>
                        </div>

                        {/* 进度条 */}
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                                style={{ width: `${(generateProgress.current / generateProgress.total) * 100}%` }}
                            />
                        </div>

                        {/* 场景进度指示 */}
                        <div className="flex gap-2 justify-center">
                            {scenes.map((scene, i) => (
                                <div
                                    key={scene.id}
                                    className={`w-3 h-3 rounded-full transition-all ${i < generateProgress.current
                                        ? 'bg-green-500'
                                        : i === generateProgress.current
                                            ? 'bg-green-500 animate-pulse'
                                            : 'bg-muted'
                                        }`}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* 取消按钮 */}
                {onCancel && phase !== 'generating' && (
                    <button
                        onClick={onCancel}
                        className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        取消，直接进入编辑器
                    </button>
                )}
            </div>
        </div>
    )
}
