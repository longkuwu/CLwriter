"use client"

import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit3, Save, X, RefreshCw } from 'lucide-react'
import { useNovelStore } from '@/lib/store/novel-store'
import {
    getEntitiesByProject,
    createEntity,
    updateEntity,
    deleteEntity,
    type EntityData,
    type EntityType
} from '@/lib/actions/entities'
import { cn } from '@/lib/utils'

const ENTITY_TYPES: Array<{ id: EntityType; label: string; icon: string; color: string }> = [
    { id: 'character', label: '角色', icon: '👤', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { id: 'location', label: '地点', icon: '🏔️', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    { id: 'faction', label: '势力', icon: '⚔️', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
    { id: 'item', label: '物品', icon: '💎', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    { id: 'foreshadow', label: '伏笔', icon: '🎯', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    { id: 'oath', label: '誓约', icon: '📜', color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
    { id: 'deadline', label: '截止', icon: '⏳', color: 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30' },
    { id: 'secret', label: '秘密', icon: '🔐', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
    { id: 'conflict', label: '冲突', icon: '🔥', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    { id: 'worldview', label: '世界观', icon: '🌍', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
]

export default function EntityManagerPanel() {
    const projectId = useNovelStore((s) => s.currentProjectId)
    const [entities, setEntities] = useState<EntityData[]>([])
    const [loading, setLoading] = useState(false)
    const [activeType, setActiveType] = useState<EntityType>('character')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)

    const loadEntities = async () => {
        if (!projectId) return
        setLoading(true)
        try {
            const list = await getEntitiesByProject(projectId, activeType)
            setEntities(list)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadEntities()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, activeType])

    const handleDelete = async (id: string) => {
        if (!confirm('确认删除该实体?')) return
        await deleteEntity(id)
        loadEntities()
    }

    if (!projectId) {
        return <div className="p-4 text-center text-xs text-muted-foreground">请先选择项目</div>
    }

    const typeInfo = ENTITY_TYPES.find(t => t.id === activeType)!

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
                <div>
                    <h3 className="text-sm font-semibold">📚 实体档案库</h3>
                    <p className="text-[10px] text-muted-foreground">管理角色、地点、伏笔等设定</p>
                </div>
                <button
                    onClick={loadEntities}
                    disabled={loading}
                    className="p-1.5 rounded hover:bg-accent/50"
                >
                    <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                </button>
            </div>

            {/* 类型切换 */}
            <div className="flex flex-wrap gap-1 p-2 border-b border-border/30">
                {ENTITY_TYPES.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => { setActiveType(t.id); setEditingId(null); setCreating(false) }}
                        className={cn(
                            'px-2 py-1 rounded text-[10px] border transition-all',
                            activeType === t.id
                                ? t.color
                                : 'border-transparent text-muted-foreground hover:bg-accent/50'
                        )}
                    >
                        <span>{t.icon}</span>
                        <span className="ml-1">{t.label}</span>
                    </button>
                ))}
            </div>

            {/* 列表 + 新建 */}
            <div className="flex-1 overflow-auto p-2 space-y-2">
                {!creating && (
                    <button
                        onClick={() => setCreating(true)}
                        className="w-full py-2 border border-dashed border-border rounded text-xs text-muted-foreground hover:bg-accent/30 hover:text-foreground transition-colors flex items-center justify-center gap-1"
                    >
                        <Plus className="h-3 w-3" />
                        新建{typeInfo.label}
                    </button>
                )}

                {creating && (
                    <EntityEditor
                        type={activeType}
                        projectId={projectId}
                        onSave={() => { setCreating(false); loadEntities() }}
                        onCancel={() => setCreating(false)}
                    />
                )}

                {entities.length === 0 && !creating ? (
                    <div className="text-center text-muted-foreground py-8 text-xs">
                        暂无{typeInfo.label}档案
                    </div>
                ) : (
                    entities.map((e) => (
                        editingId === e.id ? (
                            <EntityEditor
                                key={e.id}
                                type={activeType}
                                projectId={projectId}
                                existing={e}
                                onSave={() => { setEditingId(null); loadEntities() }}
                                onCancel={() => setEditingId(null)}
                            />
                        ) : (
                            <EntityCard
                                key={e.id}
                                entity={e}
                                onEdit={() => setEditingId(e.id)}
                                onDelete={() => handleDelete(e.id)}
                            />
                        )
                    ))
                )}
            </div>
        </div>
    )
}

function EntityCard({
    entity,
    onEdit,
    onDelete
}: {
    entity: EntityData
    onEdit: () => void
    onDelete: () => void
}) {
    return (
        <div className="p-2 rounded border border-border/30 bg-accent/30 group">
            <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{entity.name}</div>
                    {entity.archetype && (
                        <div className="text-[10px] text-muted-foreground">{entity.archetype}</div>
                    )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={onEdit} className="p-1 rounded hover:bg-accent">
                        <Edit3 className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button onClick={onDelete} className="p-1 rounded hover:bg-red-500/20">
                        <Trash2 className="h-3 w-3 text-red-400" />
                    </button>
                </div>
            </div>

            {entity.rules.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-border/20">
                    <div className="text-[9px] text-muted-foreground mb-1">规则约束:</div>
                    <div className="flex flex-wrap gap-1">
                        {entity.rules.map((r, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400">
                                {r}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {Object.keys(entity.attributes).length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-border/20 space-y-0.5">
                    {Object.entries(entity.attributes).slice(0, 5).map(([k, v]) => (
                        <div key={k} className="text-[10px] text-muted-foreground">
                            <span className="font-medium">{k}:</span> {String(v)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function EntityEditor({
    type,
    projectId,
    existing,
    onSave,
    onCancel
}: {
    type: EntityType
    projectId: string
    existing?: EntityData
    onSave: () => void
    onCancel: () => void
}) {
    const [name, setName] = useState(existing?.name || '')
    const [archetype, setArchetype] = useState(existing?.archetype || '')
    const [rulesText, setRulesText] = useState((existing?.rules || []).join('\n'))
    const [attrsText, setAttrsText] = useState(
        existing
            ? Object.entries(existing.attributes).map(([k, v]) => `${k}: ${v}`).join('\n')
            : ''
    )
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        if (!name.trim()) {
            alert('名称不能为空')
            return
        }
        setSaving(true)
        try {
            const rules = rulesText.split('\n').map(s => s.trim()).filter(Boolean)
            const attributes: Record<string, string> = {}
            for (const line of attrsText.split('\n')) {
                const idx = line.indexOf(':')
                if (idx > 0) {
                    const k = line.slice(0, idx).trim()
                    const v = line.slice(idx + 1).trim()
                    if (k) attributes[k] = v
                }
            }

            if (existing) {
                await updateEntity(existing.id, { name, archetype, rules, attributes })
            } else {
                await createEntity({ projectId, type, name, archetype, rules, attributes })
            }
            onSave()
        } catch (e) {
            console.error(e)
            alert('保存失败')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="p-2 rounded border-2 border-blue-500/50 bg-blue-500/5 space-y-2">
            <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="名称 (必填)"
                className="w-full px-2 py-1 text-sm bg-background border border-border rounded"
                autoFocus
            />
            <input
                value={archetype}
                onChange={(e) => setArchetype(e.target.value)}
                placeholder="原型/分类 (选填,如:剑修/魔头/古迹)"
                className="w-full px-2 py-1 text-xs bg-background border border-border rounded"
            />
            <div>
                <div className="text-[10px] text-muted-foreground mb-1">规则约束 (每行一条,如:畏火 / 不会御剑)</div>
                <textarea
                    value={rulesText}
                    onChange={(e) => setRulesText(e.target.value)}
                    placeholder="畏火&#10;不会御剑"
                    rows={3}
                    className="w-full px-2 py-1 text-xs bg-background border border-border rounded resize-none"
                />
            </div>
            <div>
                <div className="text-[10px] text-muted-foreground mb-1">属性 (每行 key: value)</div>
                <textarea
                    value={attrsText}
                    onChange={(e) => setAttrsText(e.target.value)}
                    placeholder="境界: 筑基期&#10;武器: 天命剑"
                    rows={3}
                    className="w-full px-2 py-1 text-xs bg-background border border-border rounded resize-none"
                />
            </div>
            <div className="flex gap-1">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 px-2 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                    <Save className="h-3 w-3" />
                    {saving ? '保存中...' : '保存'}
                </button>
                <button
                    onClick={onCancel}
                    className="px-3 py-1 text-xs rounded border border-border hover:bg-accent flex items-center gap-1"
                >
                    <X className="h-3 w-3" />
                    取消
                </button>
            </div>
        </div>
    )
}
