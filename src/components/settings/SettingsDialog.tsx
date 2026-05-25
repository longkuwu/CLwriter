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
    GlobeIcon
} from 'lucide-react'
import { AI_PROVIDERS, type AIProviderKey, saveAIConfig } from '@/lib/tauri-api'

// localStorage Keys (统一使用 tauri-api 的 keys)
const STORAGE_KEYS = {
    PROVIDER: 'ip_architect_selected_provider',
    API_KEY: 'ip_architect_api_key',
    CUSTOM_URL: 'ip_architect_custom_api_url',
    CUSTOM_MODEL: 'ip_architect_custom_model_name',
}

interface SettingsState {
    provider: AIProviderKey
    apiKey: string
    customUrl: string
    customModel: string
}

function loadSettings(): SettingsState {
    if (typeof window === 'undefined') {
        return { provider: 'deepseek', apiKey: '', customUrl: '', customModel: '' }
    }
    return {
        provider: (localStorage.getItem(STORAGE_KEYS.PROVIDER) || 'deepseek') as AIProviderKey,
        apiKey: localStorage.getItem(STORAGE_KEYS.API_KEY) || '',
        customUrl: localStorage.getItem(STORAGE_KEYS.CUSTOM_URL) || '',
        customModel: localStorage.getItem(STORAGE_KEYS.CUSTOM_MODEL) || '',
    }
}

export default function SettingsDialog() {
    const [open, setOpen] = useState(false)
    const [settings, setSettings] = useState<SettingsState>({
        provider: 'deepseek',
        apiKey: '',
        customUrl: '',
        customModel: '',
    })
    const [showKey, setShowKey] = useState(false)
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        const loaded = loadSettings()
        setSettings(loaded)

        // 如果没有 API Key，自动打开设置
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
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    const currentProvider = AI_PROVIDERS[settings.provider]

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button className="p-2 rounded-lg hover:bg-accent transition-colors" title="设置">
                    <SettingsIcon className="h-5 w-5 text-muted-foreground" />
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <SparklesIcon className="h-5 w-5 text-primary" />
                        AI 模型配置
                    </DialogTitle>
                    <DialogDescription>
                        选择 AI 服务商并配置 API Key
                    </DialogDescription>
                </DialogHeader>

                {/* 隐私保障提示 */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <ShieldCheckIcon className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-emerald-400">
                        通过 Tauri 代理请求，绕过浏览器 CORS 限制，您的 Key 仅存储在本地。
                    </p>
                </div>

                <div className="space-y-6 py-4">
                    {/* 服务商选择 */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <GlobeIcon className="h-4 w-4" />
                            选择 AI 服务商
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {(Object.keys(AI_PROVIDERS) as AIProviderKey[]).map((key) => {
                                const provider = AI_PROVIDERS[key]
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setSettings({ ...settings, provider: key })}
                                        className={`p-3 rounded-lg border transition-all text-left ${settings.provider === key
                                                ? 'border-primary bg-primary/10 text-foreground'
                                                : 'border-border hover:border-primary/50 text-muted-foreground'
                                            }`}
                                    >
                                        <div className="font-medium text-sm">{provider.name}</div>
                                        {provider.defaultModel && (
                                            <div className="text-xs opacity-70 truncate">
                                                {provider.defaultModel}
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* API Key */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <KeyIcon className="h-4 w-4" />
                            API Key
                        </label>
                        <div className="relative">
                            <Input
                                type={showKey ? 'text' : 'password'}
                                placeholder="sk-..."
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

                    {/* 自定义配置 (仅 custom 时显示) */}
                    {settings.provider === 'custom' && (
                        <div className="space-y-4 p-4 rounded-lg bg-accent/30 border border-border">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">API Base URL</label>
                                <Input
                                    type="text"
                                    placeholder="https://api.example.com/v1"
                                    value={settings.customUrl}
                                    onChange={(e) => setSettings({ ...settings, customUrl: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">模型名称</label>
                                <Input
                                    type="text"
                                    placeholder="gpt-4o / custom-model"
                                    value={settings.customModel}
                                    onChange={(e) => setSettings({ ...settings, customModel: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {/* 模型选择 (非自定义时显示) */}
                    {settings.provider !== 'custom' && currentProvider.models.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">模型</label>
                            <div className="flex flex-wrap gap-2">
                                {currentProvider.models.map((model) => (
                                    <button
                                        key={model}
                                        onClick={() => setSettings({ ...settings, customModel: model })}
                                        className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${(settings.customModel || currentProvider.defaultModel) === model
                                                ? 'border-primary bg-primary/10'
                                                : 'border-border hover:border-primary/50'
                                            }`}
                                    >
                                        {model}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
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

// 导出 hook 用于其他组件获取设置
export function useAISettings() {
    const [settings, setSettings] = useState<SettingsState>({
        provider: 'deepseek',
        apiKey: '',
        customUrl: '',
        customModel: '',
    })

    useEffect(() => {
        setSettings(loadSettings())
    }, [])

    return settings
}
