"use client"

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
    SettingsIcon,
    KeyIcon,
    ShieldCheckIcon,
    EyeIcon,
    EyeOffIcon,
    CheckCircle2Icon,
    SparklesIcon,
    GlobeIcon,
    Search,
    Loader2,
    AlertCircle,
    ChevronDown,
    Plus,
    Edit3,
    Trash2,
    Download,
    Upload,
    Code2
} from 'lucide-react'
import {
    ALL_PRESETS,
    findBlueprint
} from '@/lib/ai/protocol/presets'
import {
    getCustomBlueprints,
    upsertCustomBlueprint,
    deleteCustomBlueprint,
    exportBlueprint,
    importBlueprints,
    getActiveConfig,
    saveActiveConfig,
    generateBlueprintId
} from '@/lib/ai/protocol/storage'
import { listModelsByBlueprint } from '@/lib/ai/protocol/client'
import type { ProtocolBlueprint } from '@/lib/ai/protocol/types'
import { cn } from '@/lib/utils'
import BlueprintEditor from './BlueprintEditor'

interface ScannedModelLite {
    id: string
    name: string
    contextLength?: number
    description?: string
}

export default function SettingsDialog() {
    const [open, setOpen] = useState(false)

    // 蓝图列表
    const [customs, setCustoms] = useState<ProtocolBlueprint[]>([])

    // 当前激活的配置
    const [blueprintId, setBlueprintId] = useState('openai')
    const [baseUrl, setBaseUrl] = useState('')
    const [apiKey, setApiKey] = useState('')
    const [model, setModel] = useState('')

    // UI 状态
    const [showKey, setShowKey] = useState(false)
    const [saved, setSaved] = useState(false)
    const [scanning, setScanning] = useState(false)
    const [scannedModels, setScannedModels] = useState<ScannedModelLite[]>([])
    const [scanError, setScanError] = useState<string | null>(null)
    const [scanDebug, setScanDebug] = useState<{ url: string; status?: number; sample?: string } | null>(null)
    const [showDebug, setShowDebug] = useState(false)
    const [suggestedBaseUrl, setSuggestedBaseUrl] = useState<string | null>(null)
    const [showModelDropdown, setShowModelDropdown] = useState(false)
    const [modelSearch, setModelSearch] = useState('')
    const [editingBlueprint, setEditingBlueprint] = useState<ProtocolBlueprint | null>(null)
    const [showImporter, setShowImporter] = useState(false)
    const [importText, setImportText] = useState('')
    const [importError, setImportError] = useState<string | null>(null)

    // 当前选择的蓝图
    const allBlueprints = [...ALL_PRESETS, ...customs]
    const currentBlueprint = findBlueprint(blueprintId, customs)

    // 初始化
    useEffect(() => {
        const list = getCustomBlueprints()
        setCustoms(list)
        const cfg = getActiveConfig()
        setBlueprintId(cfg.blueprintId)
        setBaseUrl(cfg.baseUrl)
        setApiKey(cfg.apiKey)
        setModel(cfg.model)
        // 自动打开
        if (!cfg.apiKey) setTimeout(() => setOpen(true), 500)
    }, [])

    // 切换蓝图时填充默认 baseUrl
    const handleBlueprintChange = (id: string) => {
        setBlueprintId(id)
        setScannedModels([])
        setScanError(null)
        const bp = findBlueprint(id, customs)
        if (bp?.defaultBaseUrl && !baseUrl) {
            setBaseUrl(bp.defaultBaseUrl)
        } else if (bp?.defaultBaseUrl) {
            // 切换时如果当前 baseUrl 不是该协议的合理 URL,也覆盖
            const isOldDefault = ALL_PRESETS.some(p => p.defaultBaseUrl === baseUrl)
            if (isOldDefault) setBaseUrl(bp.defaultBaseUrl)
        }
    }

    const handleSave = () => {
        saveActiveConfig({ blueprintId, baseUrl, apiKey, model })
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    const handleScanModels = async () => {
        if (!currentBlueprint) {
            setScanError('请先选择协议')
            return
        }
        if (!baseUrl) {
            setScanError('请先输入 Base URL')
            return
        }

        setScanning(true)
        setScanError(null)
        setScanDebug(null)
        setSuggestedBaseUrl(null)
        setScannedModels([])

        try {
            const r = await listModelsByBlueprint(currentBlueprint, baseUrl, apiKey)
            if (r.success) {
                setScannedModels(r.models)
                setShowModelDropdown(true)
                // 如果是用兜底 baseUrl 扫到的,提示用户更新
                if (r.suggestedBaseUrl) {
                    setSuggestedBaseUrl(r.suggestedBaseUrl)
                }
            } else {
                setScanError(r.error || '扫描失败')
                if (r.debug) setScanDebug(r.debug)
            }
        } catch (e) {
            setScanError(e instanceof Error ? e.message : '未知错误')
        } finally {
            setScanning(false)
        }
    }

    // 删除自定义蓝图
    const handleDeleteCustom = (id: string) => {
        if (!confirm('确认删除该自定义协议?')) return
        deleteCustomBlueprint(id)
        setCustoms(getCustomBlueprints())
        if (blueprintId === id) setBlueprintId('openai')
    }

    // 导出蓝图
    const handleExport = (bp: ProtocolBlueprint) => {
        const json = exportBlueprint(bp)
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${bp.id}.protocol.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    // 导入蓝图
    const handleImport = () => {
        const r = importBlueprints(importText)
        if (!r.success) {
            setImportError(r.error || '导入失败')
            return
        }
        for (const b of r.blueprints) upsertCustomBlueprint(b)
        setCustoms(getCustomBlueprints())
        setShowImporter(false)
        setImportText('')
        setImportError(null)
        if (r.blueprints[0]) handleBlueprintChange(r.blueprints[0].id)
    }

    const handleEditorSave = (bp: ProtocolBlueprint) => {
        upsertCustomBlueprint(bp)
        setCustoms(getCustomBlueprints())
        setEditingBlueprint(null)
        handleBlueprintChange(bp.id)
    }

    const filteredModels = modelSearch
        ? scannedModels.filter(m =>
            m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
            m.name.toLowerCase().includes(modelSearch.toLowerCase())
        )
        : scannedModels

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <button className="p-2 rounded-lg hover:bg-accent transition-colors" title="设置">
                        <SettingsIcon className="h-5 w-5 text-muted-foreground" />
                    </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <SparklesIcon className="h-5 w-5 text-primary" />
                            AI 协议配置
                        </DialogTitle>
                        <DialogDescription>
                            选择协议蓝图,或自定义新协议接入任何 LLM API
                        </DialogDescription>
                    </DialogHeader>

                    {/* 隐私提示 */}
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <ShieldCheckIcon className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-emerald-400">
                            所有数据仅存储在本地,通过 Tauri/代理转发请求绕过 CORS
                        </p>
                    </div>

                    <div className="space-y-5 py-2">
                        {/* 协议选择 + 操作 */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <GlobeIcon className="h-4 w-4" />
                                    协议蓝图
                                </label>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => {
                                            const newBp: ProtocolBlueprint = {
                                                id: generateBlueprintId('新协议'),
                                                name: '新协议',
                                                builtIn: false,
                                                auth: { location: 'header', name: 'Authorization', valuePattern: 'Bearer {key}' },
                                                chatEndpoint: '{baseUrl}/chat/completions',
                                                listModels: { endpoint: '{baseUrl}/models' },
                                                schema: {
                                                    messageFormat: 'openai',
                                                    responsePath: 'choices.0.message.content',
                                                    streamChunkPath: 'choices.0.delta.content',
                                                    modelListPath: 'data',
                                                    modelIdField: 'id'
                                                }
                                            }
                                            setEditingBlueprint(newBp)
                                        }}
                                        className="text-[11px] px-2 py-1 rounded border border-border hover:bg-accent flex items-center gap-1"
                                    >
                                        <Plus className="h-3 w-3" />
                                        新建
                                    </button>
                                    <button
                                        onClick={() => setShowImporter(true)}
                                        className="text-[11px] px-2 py-1 rounded border border-border hover:bg-accent flex items-center gap-1"
                                    >
                                        <Upload className="h-3 w-3" />
                                        导入
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-auto p-1">
                                {allBlueprints.map((bp) => (
                                    <BlueprintCard
                                        key={bp.id}
                                        blueprint={bp}
                                        active={blueprintId === bp.id}
                                        onSelect={() => handleBlueprintChange(bp.id)}
                                        onEdit={() => setEditingBlueprint(bp)}
                                        onDelete={!bp.builtIn ? () => handleDeleteCustom(bp.id) : undefined}
                                        onExport={() => handleExport(bp)}
                                    />
                                ))}
                            </div>

                            {currentBlueprint?.description && (
                                <p className="text-[11px] text-muted-foreground pl-1">
                                    {currentBlueprint.description}
                                </p>
                            )}
                        </div>

                        {/* Base URL */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Base URL</label>
                            <Input
                                type="text"
                                placeholder={currentBlueprint?.defaultBaseUrl || 'https://...'}
                                value={baseUrl}
                                onChange={(e) => {
                                    setBaseUrl(e.target.value)
                                    setSuggestedBaseUrl(null)
                                }}
                            />
                            {suggestedBaseUrl && suggestedBaseUrl !== baseUrl && (
                                <div className="flex items-center justify-between gap-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/30">
                                    <div className="text-xs text-emerald-400 flex-1 min-w-0">
                                        ✨ 检测到正确的 Base URL:
                                        <code className="ml-1 font-mono break-all">{suggestedBaseUrl}</code>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setBaseUrl(suggestedBaseUrl)
                                            setSuggestedBaseUrl(null)
                                        }}
                                        className="text-[11px] px-2 py-0.5 rounded bg-emerald-500 text-white hover:bg-emerald-600 shrink-0"
                                    >
                                        采用
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* API Key */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <KeyIcon className="h-4 w-4" />
                                API Key
                                {currentBlueprint?.auth.location === 'none' && (
                                    <span className="text-[10px] text-muted-foreground">(此协议不需要)</span>
                                )}
                            </label>
                            <div className="relative">
                                <Input
                                    type={showKey ? 'text' : 'password'}
                                    placeholder="sk-..."
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    className="pr-10"
                                    disabled={currentBlueprint?.auth.location === 'none'}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKey(!showKey)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showKey ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {/* 模型选择 */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">模型</label>
                                <button
                                    onClick={handleScanModels}
                                    disabled={scanning || !currentBlueprint?.listModels?.endpoint}
                                    className={cn(
                                        'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                                        'bg-gradient-to-r from-primary to-purple-500 text-primary-foreground',
                                        'hover:opacity-90 disabled:opacity-50'
                                    )}
                                >
                                    {scanning ? (
                                        <><Loader2 className="h-3 w-3 animate-spin" />扫描中...</>
                                    ) : (
                                        <><Search className="h-3 w-3" />扫描模型</>
                                    )}
                                </button>
                            </div>

                            {scanError && (
                                <div className="space-y-1.5">
                                    <div className="flex items-start gap-2 p-2 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                        <div className="flex-1">
                                            <div className="font-medium">扫描失败</div>
                                            <div className="text-[11px] opacity-80 break-all">{scanError}</div>
                                        </div>
                                    </div>

                                    {scanDebug && (
                                        <div className="rounded border border-border/50 bg-accent/30 text-[10px] overflow-hidden">
                                            <button
                                                onClick={() => setShowDebug(!showDebug)}
                                                className="w-full px-2 py-1 flex items-center justify-between hover:bg-accent/50 text-muted-foreground"
                                            >
                                                <span>🔍 调试信息 (点击{showDebug ? '收起' : '展开'})</span>
                                                <ChevronDown className={cn('h-3 w-3 transition-transform', showDebug && 'rotate-180')} />
                                            </button>
                                            {showDebug && (
                                                <div className="px-2 py-2 space-y-1 border-t border-border/50">
                                                    <div>
                                                        <span className="text-muted-foreground">实际请求 URL:</span>
                                                        <div className="font-mono break-all bg-background/50 px-1.5 py-1 rounded mt-0.5">{scanDebug.url}</div>
                                                    </div>
                                                    {scanDebug.sample && (
                                                        <div>
                                                            <span className="text-muted-foreground">响应预览:</span>
                                                            <pre className="font-mono break-all bg-background/50 px-1.5 py-1 rounded mt-0.5 max-h-32 overflow-auto whitespace-pre-wrap">{scanDebug.sample}</pre>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="text-[10px] text-muted-foreground space-y-0.5 pl-1">
                                        <div>💡 常见解决方案:</div>
                                        <div className="pl-3">• 检查 Base URL 是否带了 <code className="font-mono bg-accent/40 px-1 rounded">/v1</code> 等版本前缀</div>
                                        <div className="pl-3">• 检查 API Key 是否正确</div>
                                        <div className="pl-3">• 中转服务一般是 OpenAI 兼容,可换成「OpenAI 兼容」或「NewAPI」协议</div>
                                    </div>
                                </div>
                            )}

                            {scannedModels.length > 0 ? (
                                <div className="border border-border rounded-md overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setShowModelDropdown(!showModelDropdown)}
                                        className="w-full flex items-center justify-between px-3 py-2 bg-background hover:bg-accent/50"
                                    >
                                        <div className="text-left flex-1 min-w-0">
                                            {model ? (
                                                <div className="text-sm font-medium truncate">{model}</div>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">选择模型...</div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                            <span>{scannedModels.length} 个</span>
                                            <ChevronDown className={cn('h-4 w-4 transition-transform', showModelDropdown && 'rotate-180')} />
                                        </div>
                                    </button>

                                    {showModelDropdown && (
                                        <div className="border-t border-border bg-card">
                                            <div className="p-2 border-b border-border/50">
                                                <input
                                                    type="text"
                                                    placeholder="搜索模型..."
                                                    value={modelSearch}
                                                    onChange={(e) => setModelSearch(e.target.value)}
                                                    className="w-full px-2 py-1 text-xs bg-background border border-border rounded"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="max-h-64 overflow-auto">
                                                {filteredModels.length === 0 ? (
                                                    <div className="p-4 text-center text-xs text-muted-foreground">
                                                        未找到匹配的模型
                                                    </div>
                                                ) : (
                                                    filteredModels.map((m) => (
                                                        <button
                                                            key={m.id}
                                                            onClick={() => {
                                                                setModel(m.id)
                                                                setShowModelDropdown(false)
                                                            }}
                                                            className={cn(
                                                                'w-full text-left px-3 py-2 hover:bg-accent border-b border-border/30 last:border-0',
                                                                model === m.id && 'bg-primary/10'
                                                            )}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div className="text-sm font-medium truncate">{m.id}</div>
                                                                {model === m.id && <CheckCircle2Icon className="h-3.5 w-3.5 text-primary shrink-0" />}
                                                            </div>
                                                            {(m.contextLength || m.description) && (
                                                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                                                    {m.contextLength && <span>{m.contextLength.toLocaleString()} ctx</span>}
                                                                    {m.contextLength && m.description && <span> · </span>}
                                                                    {m.description && <span className="truncate">{m.description}</span>}
                                                                </div>
                                                            )}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <Input
                                    type="text"
                                    placeholder="模型 ID (如 gpt-4o),或点扫描自动发现"
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                />
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            取消
                        </Button>
                        <Button onClick={handleSave} disabled={saved}>
                            {saved ? (
                                <><CheckCircle2Icon className="h-4 w-4" />已保存</>
                            ) : (
                                '保存设置'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 蓝图编辑器 */}
            {editingBlueprint && (
                <BlueprintEditor
                    blueprint={editingBlueprint}
                    onSave={handleEditorSave}
                    onCancel={() => setEditingBlueprint(null)}
                />
            )}

            {/* JSON 导入弹窗 */}
            {showImporter && (
                <Dialog open={showImporter} onOpenChange={setShowImporter}>
                    <DialogContent className="sm:max-w-[560px]">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Upload className="h-4 w-4" />
                                导入协议蓝图 JSON
                            </DialogTitle>
                            <DialogDescription>
                                粘贴蓝图 JSON 即可导入
                            </DialogDescription>
                        </DialogHeader>
                        <textarea
                            value={importText}
                            onChange={(e) => setImportText(e.target.value)}
                            placeholder='{ "id": "my-protocol", "name": "我的协议", ... }'
                            rows={10}
                            className="w-full p-2 text-xs font-mono bg-background border border-border rounded resize-none"
                        />
                        {importError && (
                            <div className="text-xs text-red-400">{importError}</div>
                        )}
                        <DialogFooter>
                            <Button variant="outline" onClick={() => { setShowImporter(false); setImportText(''); setImportError(null) }}>
                                取消
                            </Button>
                            <Button onClick={handleImport} disabled={!importText.trim()}>
                                导入
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    )
}

// ========== 蓝图卡片 ==========

function BlueprintCard({
    blueprint,
    active,
    onSelect,
    onEdit,
    onDelete,
    onExport
}: {
    blueprint: ProtocolBlueprint
    active: boolean
    onSelect: () => void
    onEdit: () => void
    onDelete?: () => void
    onExport: () => void
}) {
    return (
        <div
            className={cn(
                'group relative px-2 py-1.5 rounded border text-left transition-all cursor-pointer',
                active
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
            )}
            onClick={onSelect}
        >
            <div className="flex items-center gap-1.5">
                {blueprint.icon && <span className="text-sm">{blueprint.icon}</span>}
                <div className="font-medium text-xs truncate flex-1">{blueprint.name}</div>
                {!blueprint.builtIn && (
                    <span className="text-[9px] px-1 rounded bg-purple-500/20 text-purple-400">自定义</span>
                )}
            </div>

            {/* hover 操作 */}
            <div className="absolute right-1 top-1 hidden group-hover:flex gap-0.5 bg-card rounded shadow-md p-0.5">
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit() }}
                    className="p-0.5 rounded hover:bg-accent"
                    title={blueprint.builtIn ? '查看' : '编辑'}
                >
                    <Edit3 className="h-2.5 w-2.5" />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onExport() }}
                    className="p-0.5 rounded hover:bg-accent"
                    title="导出 JSON"
                >
                    <Download className="h-2.5 w-2.5" />
                </button>
                {onDelete && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete() }}
                        className="p-0.5 rounded hover:bg-red-500/20"
                        title="删除"
                    >
                        <Trash2 className="h-2.5 w-2.5 text-red-400" />
                    </button>
                )}
            </div>
        </div>
    )
}

// 兼容老的 hook
export function useAISettings() {
    const [config, setConfig] = useState({
        provider: 'deepseek' as const,
        apiKey: '',
        customUrl: '',
        customModel: '',
        customProtocol: 'auto' as const,
    })
    useEffect(() => {
        const cfg = getActiveConfig()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setConfig((c: any) => ({ ...c, apiKey: cfg.apiKey, customUrl: cfg.baseUrl, customModel: cfg.model }))
    }, [])
    return config
}
