"use client"

import { useState, useEffect } from 'react'
import { Shield, CheckCircle2, XCircle, AlertTriangle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { useNovelStore } from '@/lib/store/novel-store'
import { getDatabase } from '@/lib/db'
import { gateLogs } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { cn } from '@/lib/utils'

interface GateLogRow {
    id: string
    chapterOrder: number
    gateName: string
    passed: boolean
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    errors: any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    warnings: any[]
    triggeredAt: Date
}

const GATE_LABELS: Record<string, string> = {
    gate1_protocol: '①协议',
    gate2_reference: '②引用',
    gate3_consistency: '③一致性',
    gate4_unknown: '④未知实体',
    gate5_description: '⑤描写',
    gate6_blueprint: '⑥蓝图'
}

export default function GateLogPanel() {
    const projectId = useNovelStore((s) => s.currentProjectId)
    const [logs, setLogs] = useState<GateLogRow[]>([])
    const [loading, setLoading] = useState(false)
    const [expandedChapter, setExpandedChapter] = useState<number | null>(null)

    const loadLogs = async () => {
        if (!projectId) return
        setLoading(true)
        try {
            const db = await getDatabase()
            const rows = await db.select()
                .from(gateLogs)
                .where(eq(gateLogs.projectId, projectId))
                .orderBy(desc(gateLogs.triggeredAt))
                .limit(200)
            setLogs(rows as unknown as GateLogRow[])
        } catch (e) {
            console.error('[GateLogPanel] 加载失败', e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadLogs()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId])

    // 按章节分组
    const groupedByChapter = logs.reduce<Record<number, GateLogRow[]>>((acc, log) => {
        if (!acc[log.chapterOrder]) acc[log.chapterOrder] = []
        acc[log.chapterOrder].push(log)
        return acc
    }, {})

    const chapterOrders = Object.keys(groupedByChapter).map(Number).sort((a, b) => b - a)

    if (!projectId) {
        return <div className="p-4 text-center text-xs text-muted-foreground">请先选择项目</div>
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
                <div>
                    <h3 className="text-sm font-semibold flex items-center gap-1.5">
                        <Shield className="h-4 w-4 text-emerald-400" />
                        门禁日志
                    </h3>
                    <p className="text-[10px] text-muted-foreground">6 道生成门禁的检查记录</p>
                </div>
                <button
                    onClick={loadLogs}
                    disabled={loading}
                    className="p-1.5 rounded hover:bg-accent/50"
                    title="刷新"
                >
                    <RefreshCw className={cn('h-3.5 w-3.5 text-muted-foreground', loading && 'animate-spin')} />
                </button>
            </div>

            <div className="flex-1 overflow-auto p-2 text-xs">
                {chapterOrders.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                        暂无门禁记录
                        <br />
                        <span className="text-[10px]">使用引擎生成章节后会产生记录</span>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {chapterOrders.map((chapter) => {
                            const gateLogs = groupedByChapter[chapter]
                            const allPassed = gateLogs.every(g => g.passed)
                            const errorCount = gateLogs.reduce((s, g) => s + (g.errors?.length || 0), 0)
                            const warningCount = gateLogs.reduce((s, g) => s + (g.warnings?.length || 0), 0)
                            const expanded = expandedChapter === chapter

                            return (
                                <div key={chapter} className="rounded border border-border/30 overflow-hidden">
                                    <button
                                        onClick={() => setExpandedChapter(expanded ? null : chapter)}
                                        className={cn(
                                            'w-full flex items-center gap-2 px-2 py-1.5 transition-colors',
                                            allPassed ? 'bg-green-500/10 hover:bg-green-500/20' : 'bg-red-500/10 hover:bg-red-500/20'
                                        )}
                                    >
                                        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                        {allPassed ? (
                                            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                                        ) : (
                                            <XCircle className="h-3.5 w-3.5 text-red-400" />
                                        )}
                                        <span className="font-medium">第{chapter}章</span>
                                        <span className="text-muted-foreground ml-auto text-[10px]">
                                            {errorCount > 0 && <span className="text-red-400 mr-2">{errorCount} 错误</span>}
                                            {warningCount > 0 && <span className="text-amber-400">{warningCount} 警告</span>}
                                        </span>
                                    </button>

                                    {expanded && (
                                        <div className="bg-card divide-y divide-border/30">
                                            {gateLogs.map((g) => (
                                                <GateLogItem key={g.id} log={g} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

function GateLogItem({ log }: { log: GateLogRow }) {
    return (
        <div className="px-2 py-1.5 text-[11px]">
            <div className="flex items-center gap-1.5">
                {log.passed ? (
                    <CheckCircle2 className="h-3 w-3 text-green-400" />
                ) : (
                    <XCircle className="h-3 w-3 text-red-400" />
                )}
                <span className="font-medium">{GATE_LABELS[log.gateName] || log.gateName}</span>
            </div>
            {log.errors?.length > 0 && (
                <div className="mt-1 space-y-0.5 ml-4">
                    {log.errors.map((e, i) => (
                        <div key={i} className="text-red-400 text-[10px]">
                            ❌ {e.message || JSON.stringify(e)}
                        </div>
                    ))}
                </div>
            )}
            {log.warnings?.length > 0 && (
                <div className="mt-1 space-y-0.5 ml-4">
                    {log.warnings.map((w, i) => (
                        <div key={i} className="text-amber-400 text-[10px]">
                            <AlertTriangle className="h-2.5 w-2.5 inline mr-0.5" />
                            {w.message || JSON.stringify(w)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
