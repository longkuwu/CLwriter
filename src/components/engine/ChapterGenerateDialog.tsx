"use client"

import { useState, useEffect } from 'react'
import { Sparkles, Loader2, X, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useNovelStore } from '@/lib/store/novel-store'
import { generateChapterWithEngine } from '@/lib/engine/generate'
import { getEntitiesByProject, type EntityData } from '@/lib/actions/entities'
import { createFile } from '@/lib/actions/files'
import type { OrchestratorResult } from '@/lib/engine/gates/types'
import { cn } from '@/lib/utils'

interface Props {
    open: boolean
    onClose: () => void
    onSuccess?: (fileId: string, body: string) => void
}

/**
 * 引擎驱动的章节生成对话框
 * - 用户填写蓝图 (标题、必出场角色、场景清单)
 * - 调用 generateChapterWithEngine
 * - 显示门禁结果与生成内容
 */
export default function ChapterGenerateDialog({ open, onClose, onSuccess }: Props) {
    const projectId = useNovelStore((s) => s.currentProjectId)

    // 表单
    const [title, setTitle] = useState('')
    const [chapterOrder, setChapterOrder] = useState(1)
    const [pivotChar, setPivotChar] = useState('')
    const [targetChars, setTargetChars] = useState<string[]>([])
    const [targetLocs, setTargetLocs] = useState<string[]>([])
    const [scenes, setScenes] = useState('')
    const [extraInst, setExtraInst] = useState('')

    // 数据
    const [characters, setCharacters] = useState<EntityData[]>([])
    const [locations, setLocations] = useState<EntityData[]>([])

    // 生成状态
    const [generating, setGenerating] = useState(false)
    const [result, setResult] = useState<{
        success: boolean
        body: string
        gateResult: OrchestratorResult | null
        retries: number
        error?: string
    } | null>(null)

    useEffect(() => {
        if (!open || !projectId) return
        ;(async () => {
            const chars = await getEntitiesByProject(projectId, 'character')
            const locs = await getEntitiesByProject(projectId, 'location')
            setCharacters(chars)
            setLocations(locs)
        })()
    }, [open, projectId])

    const toggleChar = (name: string) => {
        setTargetChars((prev) => prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name])
    }

    const toggleLoc = (name: string) => {
        setTargetLocs((prev) => prev.includes(name) ? prev.filter(l => l !== name) : [...prev, name])
    }

    const handleGenerate = async () => {
        if (!projectId) return
        if (!title.trim()) {
            alert('请输入章节标题')
            return
        }

        setGenerating(true)
        setResult(null)

        try {
            // 先创建一个空的章节文件,得到 chapterId
            const file = await createFile({
                projectId,
                title,
                type: 'chapter',
                content: `# ${title}\n\n[生成中...]`,
                order: chapterOrder
            })

            if (!file) {
                alert('创建章节文件失败')
                return
            }

            const sceneList = scenes.split('\n').map(s => s.trim()).filter(Boolean)

            const r = await generateChapterWithEngine({
                projectId,
                chapterId: file.id,
                chapterOrder,
                blueprint: {
                    title,
                    pivotCharacterId: pivotChar || undefined,
                    targetCharacterIds: targetChars,
                    targetLocationIds: targetLocs,
                    targetFactionIds: [],
                    expectedScenes: sceneList,
                    minWordCount: 1500,
                    maxWordCount: 3500
                },
                extraInstruction: extraInst || undefined,
                maxRetries: 2
            })

            setResult(r)

            if (r.success && r.body) {
                onSuccess?.(file.id, r.body)
            }
        } catch (e) {
            console.error('[Generate] 失败:', e)
            setResult({
                success: false,
                body: '',
                gateResult: null,
                retries: 0,
                error: e instanceof Error ? e.message : '未知错误'
            })
        } finally {
            setGenerating(false)
        }
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                {/* 头部 */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-purple-500/10">
                    <div>
                        <h2 className="text-base font-semibold flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            状态驱动 - 章节生成
                        </h2>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            数据中心打包 → AI 生成 → 6 道门禁 → 状态回写
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded hover:bg-accent">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* 内容 */}
                <div className="flex-1 overflow-auto p-4 space-y-4">
                    {/* 表单 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">章节标题</label>
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="例: 张三叛出宗门"
                                className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">章节序号</label>
                            <input
                                type="number"
                                value={chapterOrder}
                                onChange={(e) => setChapterOrder(parseInt(e.target.value) || 1)}
                                className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">视角角色 (选填)</label>
                        <select
                            value={pivotChar}
                            onChange={(e) => setPivotChar(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded"
                        >
                            <option value="">无</option>
                            {characters.map((c) => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">必出场角色 ({targetChars.length})</label>
                        <div className="flex flex-wrap gap-1 p-2 border border-border rounded bg-background">
                            {characters.length === 0 ? (
                                <span className="text-[11px] text-muted-foreground">请先在【实体档案】中创建角色</span>
                            ) : characters.map((c) => (
                                <button
                                    key={c.id}
                                    onClick={() => toggleChar(c.name)}
                                    className={cn(
                                        'px-2 py-0.5 text-[11px] rounded border transition-colors',
                                        targetChars.includes(c.name)
                                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                                            : 'border-border text-muted-foreground hover:bg-accent'
                                    )}
                                >
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">关联地点 ({targetLocs.length})</label>
                        <div className="flex flex-wrap gap-1 p-2 border border-border rounded bg-background">
                            {locations.length === 0 ? (
                                <span className="text-[11px] text-muted-foreground">无地点档案</span>
                            ) : locations.map((l) => (
                                <button
                                    key={l.id}
                                    onClick={() => toggleLoc(l.name)}
                                    className={cn(
                                        'px-2 py-0.5 text-[11px] rounded border transition-colors',
                                        targetLocs.includes(l.name)
                                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                                            : 'border-border text-muted-foreground hover:bg-accent'
                                    )}
                                >
                                    {l.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">场景清单 (每行一条)</label>
                        <textarea
                            value={scenes}
                            onChange={(e) => setScenes(e.target.value)}
                            placeholder="1. 主角与师兄起冲突&#10;2. 主角发现师门秘密&#10;3. 主角愤而出走"
                            rows={4}
                            className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded resize-none"
                        />
                    </div>

                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">补充指令 (选填)</label>
                        <textarea
                            value={extraInst}
                            onChange={(e) => setExtraInst(e.target.value)}
                            placeholder="如: 强调内心戏 / 战斗场面要紧凑..."
                            rows={2}
                            className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded resize-none"
                        />
                    </div>

                    {/* 结果展示 */}
                    {result && (
                        <div className={cn(
                            'p-3 rounded border',
                            result.success ? 'border-green-500/50 bg-green-500/10' : 'border-red-500/50 bg-red-500/10'
                        )}>
                            <div className="flex items-center gap-2 mb-2">
                                {result.success ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                                ) : (
                                    <AlertCircle className="h-4 w-4 text-red-400" />
                                )}
                                <span className="text-sm font-medium">
                                    {result.success ? '生成成功' : '生成失败'}
                                </span>
                                <span className="text-[11px] text-muted-foreground ml-auto">
                                    重试 {result.retries} 次
                                </span>
                            </div>

                            {result.error && (
                                <div className="text-xs text-red-400 mb-2">{result.error}</div>
                            )}

                            {result.gateResult && (
                                <div className="space-y-1 mb-2">
                                    {result.gateResult.results.map((g) => (
                                        <div key={g.gate} className="flex items-center gap-2 text-[11px]">
                                            {g.passed ? (
                                                <CheckCircle2 className="h-3 w-3 text-green-400" />
                                            ) : (
                                                <AlertCircle className="h-3 w-3 text-red-400" />
                                            )}
                                            <span>{g.gate}</span>
                                            {g.errors.length > 0 && (
                                                <span className="text-red-400">({g.errors.length} 错误)</span>
                                            )}
                                            {g.warnings.length > 0 && (
                                                <span className="text-amber-400">({g.warnings.length} 警告)</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {result.body && (
                                <div className="mt-2 p-2 bg-background/50 rounded max-h-40 overflow-auto text-xs whitespace-pre-wrap">
                                    {result.body.slice(0, 800)}
                                    {result.body.length > 800 && '...'}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 底部操作 */}
                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
                    <button
                        onClick={onClose}
                        disabled={generating}
                        className="px-4 py-1.5 text-sm rounded border border-border hover:bg-accent"
                    >
                        关闭
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={generating || !title.trim()}
                        className="px-4 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                生成中...
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-3.5 w-3.5" />
                                启动状态驱动生成
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
