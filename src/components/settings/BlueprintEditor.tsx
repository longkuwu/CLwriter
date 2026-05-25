"use client"

import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Code2, Eye, Save, X, BookOpen } from 'lucide-react'
import type { ProtocolBlueprint, AuthLocation } from '@/lib/ai/protocol/types'
import { cn } from '@/lib/utils'

interface Props {
    blueprint: ProtocolBlueprint
    onSave: (bp: ProtocolBlueprint) => void
    onCancel: () => void
}

type Tab = 'visual' | 'json'

/**
 * 协议蓝图编辑器
 * - 可视化模式 (表单)
 * - JSON 模式 (高级)
 */
export default function BlueprintEditor({ blueprint, onSave, onCancel }: Props) {
    const [tab, setTab] = useState<Tab>('visual')
    const [draft, setDraft] = useState<ProtocolBlueprint>({ ...blueprint })
    const [jsonText, setJsonText] = useState(JSON.stringify(blueprint, null, 2))
    const [jsonError, setJsonError] = useState<string | null>(null)

    const isReadOnly = blueprint.builtIn

    const handleSave = () => {
        if (tab === 'json') {
            try {
                const parsed = JSON.parse(jsonText) as ProtocolBlueprint
                if (!parsed.id || !parsed.name || !parsed.chatEndpoint || !parsed.auth) {
                    setJsonError('缺少必填字段: id, name, chatEndpoint, auth')
                    return
                }
                onSave({ ...parsed, builtIn: false })
            } catch (e) {
                setJsonError(e instanceof Error ? e.message : 'JSON 错误')
            }
            return
        }
        onSave(draft)
    }

    return (
        <Dialog open={true} onOpenChange={(o) => !o && onCancel()}>
            <DialogContent className="sm:max-w-[720px] max-h-[92vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        {isReadOnly ? '查看协议蓝图' : (blueprint.name === '新协议' ? '新建协议蓝图' : '编辑协议蓝图')}
                    </DialogTitle>
                    <DialogDescription>
                        {isReadOnly
                            ? '内置协议为只读,可点击导出后修改并导入为自定义协议'
                            : '配置协议的鉴权方式、请求格式、响应解析规则'}
                    </DialogDescription>
                </DialogHeader>

                {/* Tab */}
                <div className="flex border-b border-border">
                    <button
                        onClick={() => setTab('visual')}
                        className={cn(
                            'px-3 py-1.5 text-xs flex items-center gap-1 border-b-2 transition-colors',
                            tab === 'visual' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
                        )}
                    >
                        <Eye className="h-3 w-3" />
                        可视化
                    </button>
                    <button
                        onClick={() => setTab('json')}
                        className={cn(
                            'px-3 py-1.5 text-xs flex items-center gap-1 border-b-2 transition-colors',
                            tab === 'json' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
                        )}
                    >
                        <Code2 className="h-3 w-3" />
                        JSON 高级
                    </button>
                </div>

                <div className="flex-1 overflow-auto py-3">
                    {tab === 'visual' ? (
                        <VisualEditor draft={draft} setDraft={setDraft} readOnly={isReadOnly} />
                    ) : (
                        <div className="space-y-2">
                            <textarea
                                value={jsonText}
                                onChange={(e) => { setJsonText(e.target.value); setJsonError(null) }}
                                rows={20}
                                readOnly={isReadOnly}
                                className="w-full p-2 text-xs font-mono bg-background border border-border rounded resize-none"
                                spellCheck={false}
                            />
                            {jsonError && <div className="text-xs text-red-400">{jsonError}</div>}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>
                        <X className="h-3.5 w-3.5" />
                        关闭
                    </Button>
                    {!isReadOnly && (
                        <Button onClick={handleSave}>
                            <Save className="h-3.5 w-3.5" />
                            保存
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ========== 可视化编辑器 ==========

function VisualEditor({
    draft,
    setDraft,
    readOnly
}: {
    draft: ProtocolBlueprint
    setDraft: (b: ProtocolBlueprint) => void
    readOnly: boolean
}) {
    const update = <K extends keyof ProtocolBlueprint>(k: K, v: ProtocolBlueprint[K]) => {
        setDraft({ ...draft, [k]: v })
    }

    const updateAuth = <K extends keyof ProtocolBlueprint['auth']>(k: K, v: ProtocolBlueprint['auth'][K]) => {
        setDraft({ ...draft, auth: { ...draft.auth, [k]: v } })
    }

    const updateSchema = <K extends keyof NonNullable<ProtocolBlueprint['schema']>>(
        k: K,
        v: NonNullable<ProtocolBlueprint['schema']>[K]
    ) => {
        const s = draft.schema || {
            messageFormat: 'openai' as const,
            responsePath: 'choices.0.message.content'
        }
        setDraft({ ...draft, schema: { ...s, [k]: v } })
    }

    return (
        <div className="space-y-4">
            {/* 基础信息 */}
            <Section title="基础信息">
                <Field label="协议名称">
                    <Input value={draft.name} onChange={(e) => update('name', e.target.value)} disabled={readOnly} />
                </Field>
                <Field label="协议 ID">
                    <Input value={draft.id} onChange={(e) => update('id', e.target.value)} disabled={readOnly} />
                </Field>
                <Field label="图标 (emoji)">
                    <Input value={draft.icon || ''} onChange={(e) => update('icon', e.target.value)} disabled={readOnly} placeholder="🤖" />
                </Field>
                <Field label="描述">
                    <Input value={draft.description || ''} onChange={(e) => update('description', e.target.value)} disabled={readOnly} />
                </Field>
                <Field label="默认 Base URL">
                    <Input
                        value={draft.defaultBaseUrl || ''}
                        onChange={(e) => update('defaultBaseUrl', e.target.value)}
                        disabled={readOnly}
                        placeholder="https://api.example.com"
                    />
                </Field>
            </Section>

            {/* 鉴权 */}
            <Section title="鉴权">
                <Field label="鉴权位置">
                    <select
                        value={draft.auth.location}
                        onChange={(e) => updateAuth('location', e.target.value as AuthLocation)}
                        disabled={readOnly}
                        className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded"
                    >
                        <option value="header">Header (常用)</option>
                        <option value="query">Query 参数 (Gemini)</option>
                        <option value="body">Body 字段</option>
                        <option value="none">无需鉴权</option>
                    </select>
                </Field>
                {draft.auth.location !== 'none' && (
                    <>
                        <Field label="字段名">
                            <Input
                                value={draft.auth.name || ''}
                                onChange={(e) => updateAuth('name', e.target.value)}
                                disabled={readOnly}
                                placeholder="Authorization / x-api-key / key"
                            />
                        </Field>
                        <Field label="值模板">
                            <Input
                                value={draft.auth.valuePattern || '{key}'}
                                onChange={(e) => updateAuth('valuePattern', e.target.value)}
                                disabled={readOnly}
                                placeholder="Bearer {key}"
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">
                                用 {'{key}'} 引用用户配置的 API Key
                            </p>
                        </Field>
                    </>
                )}
                <Field label="附加 Headers (JSON)">
                    <textarea
                        value={JSON.stringify(draft.auth.extra || {}, null, 2)}
                        onChange={(e) => {
                            try {
                                updateAuth('extra', JSON.parse(e.target.value))
                            } catch {/* 等待用户输完 */}
                        }}
                        readOnly={readOnly}
                        rows={2}
                        className="w-full px-2 py-1.5 text-xs font-mono bg-background border border-border rounded"
                        placeholder='{"anthropic-version": "2023-06-01"}'
                    />
                </Field>
            </Section>

            {/* 端点 */}
            <Section title="端点">
                <Field label="对话端点">
                    <Input
                        value={draft.chatEndpoint}
                        onChange={(e) => update('chatEndpoint', e.target.value)}
                        disabled={readOnly}
                        placeholder="{baseUrl}/chat/completions"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                        变量: {'{baseUrl}'} {'{model}'} {'{key}'}
                    </p>
                </Field>
                <Field label="模型列表端点 (扫描用)">
                    <Input
                        value={draft.listModels?.endpoint || ''}
                        onChange={(e) => update('listModels', e.target.value ? { endpoint: e.target.value } : undefined)}
                        disabled={readOnly}
                        placeholder="{baseUrl}/models (留空=不支持扫描)"
                    />
                </Field>
            </Section>

            {/* 协议格式 */}
            <Section title="请求/响应格式">
                <Field label="消息格式">
                    <select
                        value={draft.schema?.messageFormat || 'openai'}
                        onChange={(e) => updateSchema('messageFormat', e.target.value as 'openai' | 'anthropic' | 'gemini' | 'flat')}
                        disabled={readOnly}
                        className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded"
                    >
                        <option value="openai">OpenAI 格式 (messages 数组)</option>
                        <option value="anthropic">Anthropic 格式 (system 单独)</option>
                        <option value="gemini">Gemini 格式 (contents + parts)</option>
                        <option value="flat">扁平 prompt (旧式 completion)</option>
                    </select>
                </Field>
                <Field label="响应文本路径 (dot-path)">
                    <Input
                        value={draft.schema?.responsePath || ''}
                        onChange={(e) => updateSchema('responsePath', e.target.value)}
                        disabled={readOnly}
                        placeholder="choices.0.message.content"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                        OpenAI: choices.0.message.content · Anthropic: content · Gemini: candidates.0.content.parts.0.text
                    </p>
                </Field>
                <Field label="流式 chunk 路径">
                    <Input
                        value={draft.schema?.streamChunkPath || ''}
                        onChange={(e) => updateSchema('streamChunkPath', e.target.value)}
                        disabled={readOnly}
                        placeholder="choices.0.delta.content"
                    />
                </Field>
            </Section>

            {/* 模型扫描 */}
            <Section title="模型扫描解析">
                <Field label="模型列表路径">
                    <Input
                        value={draft.schema?.modelListPath || ''}
                        onChange={(e) => updateSchema('modelListPath', e.target.value)}
                        disabled={readOnly}
                        placeholder="data (OpenAI) / models (Gemini/Ollama)"
                    />
                </Field>
                <Field label="模型 ID 字段">
                    <Input
                        value={draft.schema?.modelIdField || 'id'}
                        onChange={(e) => updateSchema('modelIdField', e.target.value)}
                        disabled={readOnly}
                        placeholder="id / name"
                    />
                </Field>
                <Field label="去除 'models/' 前缀 (Gemini)">
                    <input
                        type="checkbox"
                        checked={draft.schema?.stripModelPrefix || false}
                        onChange={(e) => updateSchema('stripModelPrefix', e.target.checked)}
                        disabled={readOnly}
                    />
                </Field>
            </Section>

            {/* 高级 */}
            <Section title="高级 (可选)">
                <Field label="字段映射 (JSON)">
                    <textarea
                        value={JSON.stringify(draft.schema?.fieldMap || {}, null, 2)}
                        onChange={(e) => {
                            try {
                                updateSchema('fieldMap', JSON.parse(e.target.value))
                            } catch {/* 等输完 */}
                        }}
                        readOnly={readOnly}
                        rows={3}
                        className="w-full px-2 py-1.5 text-xs font-mono bg-background border border-border rounded"
                        placeholder='{"messages": "input.messages"}'
                    />
                </Field>
                <Field label="附加 body 字段 (JSON)">
                    <textarea
                        value={JSON.stringify(draft.schema?.extraBody || {}, null, 2)}
                        onChange={(e) => {
                            try {
                                updateSchema('extraBody', JSON.parse(e.target.value))
                            } catch {/* 等输完 */}
                        }}
                        readOnly={readOnly}
                        rows={3}
                        className="w-full px-2 py-1.5 text-xs font-mono bg-background border border-border rounded"
                        placeholder='{"parameters": {"result_format": "message"}}'
                    />
                </Field>
            </Section>
        </div>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2 px-1">{title}</h3>
            <div className="space-y-2 p-3 rounded border border-border bg-accent/20">
                {children}
            </div>
        </div>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
            {children}
        </div>
    )
}
