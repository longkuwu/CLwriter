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
    Wand2,
    ChevronDown
} from 'lucide-react'
import { AI_PROVIDERS, type AIProviderKey, saveAIConfig, type CustomApiProtocol } from '@/lib/tauri-api'
import { scanModels, type ScannedModel, type ApiProtocol } from '@/lib/ai/model-scanner'
import { cn } from '@/lib/utils'

const STORAGE_KEYS = {
    PROVIDER: 'ip_architect_selected_provider',
    API_KEY: 'ip_architect_api_key',
    CUSTOM_URL: 'ip_architect_custom_api_url',
    CUSTOM_MODEL: 'ip_architect_custom_model_name',
    CUSTOM_PROTOCOL: 'ip_architect_custom_api_protocol',
}

interface SettingsState {
    provider: AIProviderKey
    apiKey: string
    customUrl: string
    customModel: string
    customProtocol: CustomApiProtocol
}

function loadSettings(): SettingsState {
    if (typeof window === 'undefined') {
        return { provider: 'deepseek', apiKey: '', customUrl: '', customModel: '', customProtocol: 'auto' }
    }
    return {
        provider: (localStorage.getItem(STORAGE_KEYS.PROVIDER) || 'deepseek') as AIProviderKey,
        apiKey: localStorage.getItem(STORAGE_KEYS.API_KEY) || '',
        customUrl: localStorage.getItem(STORAGE_KEYS.CUSTOM_URL) || '',
        customModel: localStorage.getItem(STORAGE_KEYS.CUSTOM_MODEL) || '',
        customProtocol: (localStorage.getItem(STORAGE_KEYS.CUSTOM_PROTOCOL) || 'auto') as CustomApiProtocol,
    }
}

const PROTOCOL_LABELS: Record<CustomApiProtocol, string> = {
    auto: '自动检测',
    openai: 'OpenAI 兼容 (推荐)',
    anthropic: 'Anthropic 原生',
    gemini: 'Google Gemini',
    ollama: 'Ollama 本地',
}

export default function SettingsDialog() {
    const [open, setOpen] = useState(false)
    const [settings, setSettings] = useState<SettingsState>({
        provider: 'deepseek',
        apiKey: '',
        customUrl: '',
        customModel: '',
        customProtocol: 'auto',
    })
    const [showKey, setShowKey] = useState(false)
    const [saved, setSaved] = useState(false)

    // 模型扫描状态
    const [scanning, setScanning] = useState(false)
    const [scannedModels, setScannedModels] = useState<ScannedModel[]>([])
    const [scanError, setScanError] = useState<string | null>(null)
    const [detectedProtocol, setDetectedProtocol] = useState<ApiProtocol | null>(null)
    const [showModelDropdown, setShowModelDropdown] = useState(false)
    const [modelSearch, setModelSearch] = useState('')

    useEffect(() => {
        const loaded = loadSettings()
        setSettings(loaded)
        if (!loaded.apiKey) {
            setTimeout(() => setOpen(true), 500)
        }
    }, [])

    const handleSave = () => {
        saveAIConfig({
            provider: settings.provider,
            apiKey: settings.apiKey,
            customUrl: settings.customUrl,
            customModel: settings.customModel,
            customProtocol: settings.customProtocol,
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    /**
     * 扫描模型
     */
    const handleScanModels = async () => {
        // 决定扫描的 baseURL
        const url = settings.provider === 'custom'
            ? settings.customUrl
            : AI_PROVIDERS[settings.provider].baseUrl

        if (!url) {
            setScanError('请先输入 API URL')
            return
        }

        setScanning(true)
        setScanError(null)
        setScannedModels([])
        setDetectedProtocol(null)

        try {
            const result = await scanModels(url, settings.apiKey)

            if (result.success) {
                setScannedModels(result.models)
                setDetectedProtocol(result.protocol)
                setShowModelDropdown(true)

                // 如果是自定义且当前选了 auto,把检测到的协议自动写回
                if (settings.provider === 'custom' && settings.customProtocol === 'auto') {
                    setSettings(s => ({
                        ...s,
                        customProtocol: result.protocol === 'unknown' ? 'auto' : result.protocol as CustomApiProtocol,
                        customUrl: result.baseUrl  // 用规范化后的 URL
                    }))
                }
            } else {
                setScanError(result.error || '扫描失败')
            }
        } catch (e) {
            setScanError(e instanceof Error ? e.message : '未知错误')
        } finally {
            setScanning(false)
        }
    }

    const currentProvider = AI_PROVIDERS[settings.provider]
    const filteredModels = modelSearch
        ? scannedModels.filter(m =>
            m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
            m.name.toLowerCase().includes(modelSearch.toLowerCase())
        )
        : scannedModels

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button className="p-2 rounded-lg hover:bg-accent transition-colors" title="设置">
                    <SettingsIcon className="h-5 w-5 text-muted-foreground" />
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <SparklesIcon className="h-5 w-5 text-primary" />
                        AI 模型配置
                    </DialogTitle>
                    <DialogDescription>
                        选择服务商或填入自定义 API,支持自动扫描可用模型
                    </DialogDescription>
                </DialogHeader>

                {/* 隐私提示 */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <ShieldCheckIcon className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-emerald-400">
                        通过 Tauri 代理请求,绕过浏览器 CORS 限制,Key 仅存储在本地
                    </p>
                </div>

                <div className="space-y-5 py-2">
                    {/* 服务商选择 */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <GlobeIcon className="h-4 w-4" />
                            服务商
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                            {(Object.keys(AI_PROVIDERS) as AIProviderKey[]).map((key) => {
                                const provider = AI_PROVIDERS[key]
                                return (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            setSettings({ ...settings, provider: key })
                                            setScannedModels([])
                                            setDetectedProtocol(null)
                                            setScanError(null)
                                        }}
                                        className={cn(
                                            'px-2 py-1.5 rounded border text-left transition-all',
                                            settings.provider === key
                                                ? 'border-primary bg-primary/10 text-foreground'
                                                : 'border-border hover:border-primary/50 text-muted-foreground'
                                        )}
                                    >
                                        <div className="font-medium text-xs">{provider.name}</div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* 自定义 API 配置 */}
                    {settings.provider === 'custom' && (
                        <div className="space-y-3 p-3 rounded-lg bg-accent/30 border border-border">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">
                                    API Base URL
                                </label>
                                <Input
                                    type="text"
                                    placeholder="https://api.example.com  或  https://api.example.com/v1"
                                    value={settings.customUrl}
                                    onChange={(e) => setSettings({ ...settings, customUrl: e.target.value })}
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    支持自动加 /v1 路径,可以直接粘贴完整 endpoint URL
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">
                                    协议格式
                                </label>
                                <select
                                    value={settings.customProtocol}
                                    onChange={(e) => setSettings({ ...settings, customProtocol: e.target.value as CustomApiProtocol })}
                                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
                                >
                                    {Object.entries(PROTOCOL_LABELS).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                                {detectedProtocol && (
                                    <p className="text-[11px] text-emerald-400">
                                        ✓ 已检测到 {PROTOCOL_LABELS[detectedProtocol as CustomApiProtocol] || detectedProtocol} 协议
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* API Key */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <KeyIcon className="h-4 w-4" />
                            API Key
                        </label>
                        <div className="relative">
                            <Input
                                type={showKey ? 'text' : 'password'}
                                placeholder={settings.provider === 'ollama' ? '(Ollama 不需要 Key)' : 'sk-...'}
                                value={settings.apiKey}
                                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                                className="pr-10"
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

                    {/* 模型选择 + 扫描 */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Wand2 className="h-4 w-4" />
                                模型
                            </label>
                            <button
                                onClick={handleScanModels}
                                disabled={scanning}
                                className={cn(
                                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                                    'bg-gradient-to-r from-primary to-purple-500 text-primary-foreground',
                                    'hover:opacity-90 disabled:opacity-50'
                                )}
                            >
                                {scanning ? (
                                    <>
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        扫描中...
                                    </>
                                ) : (
                                    <>
                                        <Search className="h-3 w-3" />
                                        扫描模型
                                    </>
                                )}
                            </button>
                        </div>

                        {/* 扫描错误 */}
                        {scanError && (
                            <div className="flex items-start gap-2 p-2 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                <div>
                                    <div className="font-medium">扫描失败</div>
                                    <div className="text-[11px] opacity-80">{scanError}</div>
                                </div>
                            </div>
                        )}

                        {/* 扫描结果 / 模型选择 */}
                        {scannedModels.length > 0 ? (
                            <ScannedModelPicker
                                models={filteredModels}
                                allCount={scannedModels.length}
                                search={modelSearch}
                                onSearch={setModelSearch}
                                selected={settings.customModel || currentProvider.defaultModel}
                                onSelect={(id) => {
                                    setSettings({ ...settings, customModel: id })
                                    setShowModelDropdown(false)
                                }}
                                expanded={showModelDropdown}
                                onToggle={() => setShowModelDropdown(!showModelDropdown)}
                                detectedProtocol={detectedProtocol}
                            />
                        ) : (
                            <>
                                {/* 自定义模式且没扫描到 → 手动填 */}
                                {settings.provider === 'custom' ? (
                                    <Input
                                        type="text"
                                        placeholder="模型 ID (如 gpt-4o / claude-3-5-sonnet),或点扫描"
                                        value={settings.customModel}
                                        onChange={(e) => setSettings({ ...settings, customModel: e.target.value })}
                                    />
                                ) : (
                                    /* 预设服务商 → 显示内置候选 */
                                    <div className="flex flex-wrap gap-1.5">
                                        {currentProvider.models.map((model) => (
                                            <button
                                                key={model}
                                                onClick={() => setSettings({ ...settings, customModel: model })}
                                                className={cn(
                                                    'px-2.5 py-1 rounded border text-xs transition-all',
                                                    (settings.customModel || currentProvider.defaultModel) === model
                                                        ? 'border-primary bg-primary/10'
                                                        : 'border-border hover:border-primary/50'
                                                )}
                                            >
                                                {model}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <p className="text-[11px] text-muted-foreground">
                                    💡 点击「扫描模型」自动发现可用模型
                                </p>
                            </>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        取消
                    </Button>
                    <Button onClick={handleSave} disabled={saved}>
                        {saved ? (
                            <>
                                <CheckCircle2Icon className="h-4 w-4" />
                                已保存
                            </>
                        ) : (
                            '保存设置'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ========== 模型选择器组件 ==========

function ScannedModelPicker({
    models,
    allCount,
    search,
    onSearch,
    selected,
    onSelect,
    expanded,
    onToggle,
    detectedProtocol
}: {
    models: ScannedModel[]
    allCount: number
    search: string
    onSearch: (s: string) => void
    selected: string
    onSelect: (id: string) => void
    expanded: boolean
    onToggle: () => void
    detectedProtocol: ApiProtocol | null
}) {
    const selectedModel = models.find(m => m.id === selected)

    return (
        <div className="border border-border rounded-md overflow-hidden">
            {/* 当前选择/触发器 */}
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center justify-between px-3 py-2 bg-background hover:bg-accent/50 transition-colors"
            >
                <div className="text-left flex-1 min-w-0">
                    {selected ? (
                        <>
                            <div className="text-sm font-medium truncate">{selected}</div>
                            {selectedModel?.contextLength && (
                                <div className="text-[11px] text-muted-foreground">
                                    上下文: {selectedModel.contextLength.toLocaleString()} tokens
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-sm text-muted-foreground">选择模型...</div>
                    )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {detectedProtocol && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                            {detectedProtocol}
                        </span>
                    )}
                    <span>{allCount} 个</span>
                    <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
                </div>
            </button>

            {/* 下拉列表 */}
            {expanded && (
                <div className="border-t border-border bg-card">
                    {/* 搜索框 */}
                    <div className="p-2 border-b border-border/50">
                        <input
                            type="text"
                            placeholder="搜索模型..."
                            value={search}
                            onChange={(e) => onSearch(e.target.value)}
                            className="w-full px-2 py-1 text-xs bg-background border border-border rounded"
                            autoFocus
                        />
                    </div>

                    {/* 列表 */}
                    <div className="max-h-64 overflow-auto">
                        {models.length === 0 ? (
                            <div className="p-4 text-center text-xs text-muted-foreground">
                                未找到匹配的模型
                            </div>
                        ) : (
                            models.map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() => onSelect(m.id)}
                                    className={cn(
                                        'w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b border-border/30 last:border-0',
                                        selected === m.id && 'bg-primary/10'
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-medium truncate">{m.id}</div>
                                        {selected === m.id && (
                                            <CheckCircle2Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                                        )}
                                    </div>
                                    {(m.contextLength || m.description) && (
                                        <div className="text-[11px] text-muted-foreground mt-0.5">
                                            {m.contextLength && (
                                                <span>{m.contextLength.toLocaleString()} ctx</span>
                                            )}
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
    )
}

// 导出 hook 用于其他组件获取设置
export function useAISettings() {
    const [settings, setSettings] = useState<SettingsState>({
        provider: 'deepseek',
        apiKey: '',
        customUrl: '',
        customModel: '',
        customProtocol: 'auto',
    })

    useEffect(() => {
        setSettings(loadSettings())
    }, [])

    return settings
}
