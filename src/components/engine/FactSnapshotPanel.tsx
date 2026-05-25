"use client"

import { useState, useEffect } from 'react'
import {
    Users,
    MapPin,
    Eye,
    Swords,
    Bookmark,
    Layers,
    Castle,
    Flag,
    Clock,
    Package,
    Shield,
    Mountain,
    Lock,
    Scroll,
    Hourglass,
    RefreshCw
} from 'lucide-react'
import { useNovelStore } from '@/lib/store/novel-store'
import { getLatestSnapshot } from '@/lib/engine/snapshot/manager'
import type { FactSnapshot } from '@/lib/engine/snapshot/types'
import { cn } from '@/lib/utils'

const DIMENSIONS = [
    { id: 'characters', name: '角色状态', icon: Users, color: 'text-blue-400', key: 'characterStates' },
    { id: 'locations', name: '角色位置', icon: MapPin, color: 'text-cyan-400', key: 'characterLocations' },
    { id: 'appearances', name: '角色外貌', icon: Eye, color: 'text-purple-400', key: 'characterAppearances' },
    { id: 'conflicts', name: '冲突进度', icon: Swords, color: 'text-red-400', key: 'conflictStates' },
    { id: 'foreshadows', name: '伏笔状态', icon: Bookmark, color: 'text-amber-400', key: 'foreshadowStates' },
    { id: 'plotnodes', name: '剧情节点', icon: Layers, color: 'text-pink-400', key: 'plotNodes' },
    { id: 'locstates', name: '地点状态', icon: Castle, color: 'text-orange-400', key: 'locationStates' },
    { id: 'factions', name: '势力状态', icon: Flag, color: 'text-rose-400', key: 'factionStates' },
    { id: 'timeline', name: '时间线', icon: Clock, color: 'text-emerald-400', key: 'timeline' },
    { id: 'items', name: '物品状态', icon: Package, color: 'text-yellow-400', key: 'itemStates' },
    { id: 'world', name: '世界观约束', icon: Shield, color: 'text-indigo-400', key: 'worldConstraints' },
    { id: 'features', name: '地点特征', icon: Mountain, color: 'text-teal-400', key: 'locationFeatures' },
    { id: 'secrets', name: '秘密状态', icon: Lock, color: 'text-slate-400', key: 'secretStates' },
    { id: 'oaths', name: '誓约约束', icon: Scroll, color: 'text-violet-400', key: 'oathStates' },
    { id: 'deadlines', name: '截止约束', icon: Hourglass, color: 'text-fuchsia-400', key: 'deadlineStates' },
] as const

export default function FactSnapshotPanel() {
    const projectId = useNovelStore((s) => s.currentProjectId)
    const [snapshot, setSnapshot] = useState<FactSnapshot | null>(null)
    const [loading, setLoading] = useState(false)
    const [activeDim, setActiveDim] = useState<string>('characters')

    const loadSnapshot = async () => {
        if (!projectId) return
        setLoading(true)
        try {
            const snap = await getLatestSnapshot(projectId)
            setSnapshot(snap)
        } catch (e) {
            console.error('[FactSnapshotPanel] 加载失败', e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadSnapshot()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId])

    if (!projectId) {
        return (
            <div className="p-4 text-center text-xs text-muted-foreground">
                请先选择项目
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col">
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
                <div>
                    <h3 className="text-sm font-semibold text-foreground">📸 事实快照</h3>
                    <p className="text-[10px] text-muted-foreground">
                        15 维状态 · 截止第 {snapshot?.chapterOrder || 0} 章
                    </p>
                </div>
                <button
                    onClick={loadSnapshot}
                    disabled={loading}
                    className="p-1.5 rounded hover:bg-accent/50 transition-colors"
                    title="刷新"
                >
                    <RefreshCw className={cn('h-3.5 w-3.5 text-muted-foreground', loading && 'animate-spin')} />
                </button>
            </div>

            {/* 维度选择标签 */}
            <div className="grid grid-cols-3 gap-1 p-2 border-b border-border/30">
                {DIMENSIONS.map((d) => {
                    const Icon = d.icon
                    const count = snapshot
                        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          ((snapshot as any)[d.key]?.length ?? 0)
                        : 0
                    return (
                        <button
                            key={d.id}
                            onClick={() => setActiveDim(d.id)}
                            className={cn(
                                'flex flex-col items-center gap-0.5 p-1.5 rounded text-[10px] transition-colors',
                                activeDim === d.id
                                    ? 'bg-accent text-foreground'
                                    : 'text-muted-foreground hover:bg-accent/50'
                            )}
                            title={d.name}
                        >
                            <Icon className={cn('h-3.5 w-3.5', d.color)} />
                            <span className="leading-tight text-center">
                                {d.name}
                                {count > 0 && <span className="ml-0.5 opacity-70">({count})</span>}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* 内容区 */}
            <div className="flex-1 overflow-auto p-3 text-xs">
                {!snapshot ? (
                    <div className="text-center text-muted-foreground py-8">
                        暂无快照数据
                        <br />
                        <span className="text-[10px]">生成第一章后会自动产生快照</span>
                    </div>
                ) : (
                    <DimensionContent dimension={activeDim} snapshot={snapshot} />
                )}
            </div>
        </div>
    )
}

function DimensionContent({ dimension, snapshot }: { dimension: string; snapshot: FactSnapshot }) {
    switch (dimension) {
        case 'characters':
            return <CharacterStatesView data={snapshot.characterStates} />
        case 'locations':
            return <CharacterLocationsView data={snapshot.characterLocations} />
        case 'appearances':
            return <AppearancesView data={snapshot.characterAppearances} />
        case 'conflicts':
            return <ConflictsView data={snapshot.conflictStates} />
        case 'foreshadows':
            return <ForeshadowsView data={snapshot.foreshadowStates} />
        case 'plotnodes':
            return <PlotNodesView data={snapshot.plotNodes} />
        case 'locstates':
            return <LocationStatesView data={snapshot.locationStates} />
        case 'factions':
            return <FactionsView data={snapshot.factionStates} />
        case 'timeline':
            return <TimelineView data={snapshot.timeline} />
        case 'items':
            return <ItemsView data={snapshot.itemStates} />
        case 'world':
            return <WorldConstraintsView data={snapshot.worldConstraints} />
        case 'features':
            return <LocationFeaturesView data={snapshot.locationFeatures} />
        case 'secrets':
            return <SecretsView data={snapshot.secretStates} />
        case 'oaths':
            return <OathsView data={snapshot.oathStates} />
        case 'deadlines':
            return <DeadlinesView data={snapshot.deadlineStates} />
        default:
            return null
    }
}

// ========== 各维度视图 ==========

function EmptyHint() {
    return <div className="text-center text-muted-foreground/60 py-4">暂无数据</div>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CharacterStatesView({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <EmptyHint />
    return (
        <div className="space-y-2">
            {data.map((c, i) => (
                <div key={i} className="p-2 rounded bg-accent/30 border border-border/30">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-blue-400">{c.name}</span>
                        {c.realm && <span className="text-[10px] px-1 rounded bg-blue-500/20">{c.realm}</span>}
                    </div>
                    {c.psychState && <p className="text-[10px] text-muted-foreground mt-1">心理: {c.psychState}</p>}
                    {c.abilities?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {c.abilities.map((a: string, j: number) => (
                                <span key={j} className="text-[10px] px-1 rounded bg-amber-500/20 text-amber-400">
                                    {a}
                                </span>
                            ))}
                        </div>
                    )}
                    {c.lastEvent && <p className="text-[10px] text-muted-foreground mt-1 italic">"{c.lastEvent}"</p>}
                </div>
            ))}
        </div>
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CharacterLocationsView({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <EmptyHint />
    return (
        <div className="space-y-1">
            {data.map((l, i) => (
                <div key={i} className="flex items-center justify-between p-1.5 rounded bg-accent/30">
                    <span className="text-cyan-400">{l.characterId}</span>
                    <span className="text-muted-foreground">→ {l.locationName}</span>
                    <span className="text-[10px] text-muted-foreground/70">第{l.arrivedAt}章</span>
                </div>
            ))}
        </div>
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AppearancesView({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <EmptyHint />
    return (
        <div className="space-y-2">
            {data.map((a, i) => (
                <div key={i} className="p-2 rounded bg-accent/30">
                    <div className="font-medium text-purple-400">{a.characterId}</div>
                    <div className="text-[10px] text-muted-foreground space-y-0.5 mt-1">
                        {a.hairColor && <div>发色: {a.hairColor}</div>}
                        {a.eyeColor && <div>瞳色: {a.eyeColor}</div>}
                        {a.features?.length > 0 && <div>特征: {a.features.join(', ')}</div>}
                        {a.personalityTags?.length > 0 && <div>性格: {a.personalityTags.join(', ')}</div>}
                    </div>
                </div>
            ))}
        </div>
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ConflictsView({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <EmptyHint />
    const statusColor: Record<string, string> = {
        pending: 'bg-gray-500/20 text-gray-400',
        active: 'bg-orange-500/20 text-orange-400',
        escalated: 'bg-red-500/20 text-red-400',
        resolved: 'bg-green-500/20 text-green-400'
    }
    return (
        <div className="space-y-2">
            {data.map((c, i) => (
                <div key={i} className="p-2 rounded bg-accent/30">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-red-400">{c.name}</span>
                        <span className={cn('text-[10px] px-1.5 rounded', statusColor[c.status] || statusColor.active)}>
                            {c.status}
                        </span>
                    </div>
                    {c.progress?.length > 0 && (
                        <div className="text-[10px] text-muted-foreground mt-1">
                            最新: {c.progress[c.progress.length - 1]}
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ForeshadowsView({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <EmptyHint />
    return (
        <div className="space-y-2">
            {data.map((f, i) => {
                const tierColor =
                    f.tier === 1 ? 'bg-red-500/20 text-red-400' :
                    f.tier === 2 ? 'bg-amber-500/20 text-amber-400' :
                    'bg-gray-500/20 text-gray-400'
                const statusColor =
                    f.status === 'setup' ? 'bg-blue-500/20 text-blue-400' :
                    f.status === 'reinforced' ? 'bg-purple-500/20 text-purple-400' :
                    f.status === 'payoff' ? 'bg-green-500/20 text-green-400' :
                    'bg-red-500/20 text-red-400'
                return (
                    <div key={i} className="p-2 rounded bg-accent/30">
                        <div className="flex items-center gap-1 mb-1">
                            <span className={cn('text-[9px] px-1 rounded', tierColor)}>
                                Tier{f.tier}
                            </span>
                            <span className={cn('text-[9px] px-1 rounded', statusColor)}>
                                {f.status}
                            </span>
                            <span className="text-[9px] text-muted-foreground ml-auto">
                                已埋 {f.chaptersSinceSetup} 章
                            </span>
                        </div>
                        <div className="font-medium text-amber-400">{f.foreshadowId}</div>
                        {f.description && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">{f.description}</div>
                        )}
                        <div className="text-[9px] text-muted-foreground/60 mt-1">
                            埋设: 第{f.setupChapter}章
                            {f.payoffChapter && ` · 回收: 第${f.payoffChapter}章`}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PlotNodesView({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <EmptyHint />
    return (
        <div className="space-y-1">
            {data.slice().reverse().map((p, i) => (
                <div key={i} className="p-1.5 rounded bg-accent/30 text-[10px]">
                    <span className="text-pink-400 font-medium">第{p.chapterOrder}章</span>
                    <span className="ml-2">{p.keyword}</span>
                    <p className="text-muted-foreground mt-0.5">{p.summary}</p>
                </div>
            ))}
        </div>
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LocationStatesView({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <EmptyHint />
    return (
        <div className="space-y-1">
            {data.map((l, i) => (
                <div key={i} className="p-1.5 rounded bg-accent/30 text-[10px]">
                    <span className="text-orange-400 font-medium">{l.name}</span>
                    <span className="ml-2 px-1 rounded bg-orange-500/20">{l.status}</span>
                </div>
            ))}
        </div>
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FactionsView({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <EmptyHint />
    return (
        <div className="space-y-1">
            {data.map((f, i) => (
                <div key={i} className="p-1.5 rounded bg-accent/30 text-[10px]">
                    <span className="text-rose-400 font-medium">{f.name}</span>
                    <span className="ml-2 text-muted-foreground">{f.status}</span>
                </div>
            ))}
        </div>
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TimelineView({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <EmptyHint />
    return (
        <div className="space-y-1">
            {data.slice().reverse().slice(0, 20).map((t, i) => (
                <div key={i} className="p-1.5 rounded bg-accent/30 text-[10px]">
                    <span className="text-emerald-400 font-medium">第{t.chapterOrder}章</span>
                    <span className="ml-2">{t.period}</span>
                    {t.elapsedSinceLast && <span className="ml-2 text-muted-foreground">+{t.elapsedSinceLast}</span>}
                </div>
            ))}
        </div>
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ItemsView({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <EmptyHint />
    return (
        <div className="space-y-1">
            {data.map((it, i) => (
                <div key={i} className="p-1.5 rounded bg-accent/30 text-[10px]">
                    <span className="text-yellow-400 font-medium">{it.itemName}</span>
                    <span className="ml-2 text-muted-foreground">→ {it.currentOwnerId || '无人'}</span>
                    <span className="ml-2 px-1 rounded bg-yellow-500/20">{it.status}</span>
                </div>
            ))}
        </div>
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function WorldConstraintsView({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <EmptyHint />
    return (
        <div className="space-y-1">
            {data.map((w, i) => (
                <div key={i} className="p-1.5 rounded bg-accent/30 text-[10px] text-indigo-400">
                    {w.severity === 'hard' ? '🔒' : '🔓'} {w.rule}
                </div>
            ))}
        </div>
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LocationFeaturesView({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <EmptyHint />
    return (
        <div className="space-y-1">
            {data.map((l, i) => (
                <div key={i} className="p-1.5 rounded bg-accent/30 text-[10px]">
                    <span className="text-teal-400 font-medium">{l.name}</span>
                    {l.environment && <p className="text-muted-foreground">{l.environment}</p>}
                </div>
            ))}
        </div>
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SecretsView({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <EmptyHint />
    return (
        <div className="space-y-1">
            {data.map((s, i) => (
                <div key={i} className="p-1.5 rounded bg-accent/30 text-[10px]">
                    <span className="text-slate-400 font-medium">🔐 {s.name}</span>
                    <span className="ml-2 px-1 rounded bg-slate-500/20">{s.status}</span>
                    <p className="text-muted-foreground mt-0.5">知情人: {s.knowerIds?.length || 0} 人</p>
                </div>
            ))}
        </div>
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function OathsView({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <EmptyHint />
    return (
        <div className="space-y-1">
            {data.map((o, i) => (
                <div key={i} className="p-1.5 rounded bg-accent/30 text-[10px]">
                    <span className="text-violet-400 font-medium">⚔️ {o.name}</span>
                    <span className="ml-2 px-1 rounded bg-violet-500/20">{o.status}</span>
                    <p className="text-muted-foreground mt-0.5">{o.constraint}</p>
                </div>
            ))}
        </div>
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DeadlinesView({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <EmptyHint />
    return (
        <div className="space-y-1">
            {data.map((d, i) => (
                <div key={i} className="p-1.5 rounded bg-accent/30 text-[10px]">
                    <span className="text-fuchsia-400 font-medium">⏳ {d.name}</span>
                    <span className="ml-2 px-1 rounded bg-fuchsia-500/20">{d.status}</span>
                    <p className="text-muted-foreground mt-0.5">{d.countdownTo}</p>
                </div>
            ))}
        </div>
    )
}
