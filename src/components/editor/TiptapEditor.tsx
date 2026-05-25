"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
    Sparkles,
    GitBranch,
    Database,
    ChevronDown,
    ChevronUp,
    Brain,
    Search,
    CheckCircle2,
    Loader2,
    Target,
    Ban,
    MapPin
} from 'lucide-react'
import { streamWithRAG } from '@/lib/rag'
import { useNovelState } from '@/lib/novel-state'
import { analyzeText, applyChanges } from '@/lib/logic-guard'
import { predictPlotBranches } from '@/lib/ai/brainstorm'
import { saveChapterWithSummary } from '@/lib/ai/summary'
import { useNovelStore, type Prediction, type PredictionType } from '@/lib/store/novel-store'
import { updateFile, getFileById } from '@/lib/actions/files'
import ChapterLauncher from './ChapterLauncher'
import EngineSwitch from './EngineSwitch'
import ViralFlow from './ViralFlow'
import RhythmMonitor from './RhythmMonitor'
import ReaderSandbox from './ReaderSandbox'
import { analyzeEntities } from '@/lib/analysis/entity'

// 思维链状态类型
type CoTStatus = 'idle' | 'searching' | 'found' | 'generating' | 'done' | 'error'

// 检索到的记忆条目
interface RetrievedMemory {
    content: string
    similarity: number
}

// 指令表单状态
interface CommandForm {
    currentState: string  // 起点
    goal: string          // 目标
    constraint: string    // 禁忌/风格约束
}

export default function TiptapEditor() {
    // 指令表单状态
    const [commandForm, setCommandForm] = useState<CommandForm>({
        currentState: '',
        goal: '',
        constraint: '',
    })
    const [isGenerating, setIsGenerating] = useState(false)
    const [retrievedMemories, setRetrievedMemories] = useState<RetrievedMemory[]>([])
    const [cotStatus, setCotStatus] = useState<CoTStatus>('idle')
    const [cotExpanded, setCotExpanded] = useState(true)
    const [isBrainstorming, setIsBrainstorming] = useState(false)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isSavingChapter, setIsSavingChapter] = useState(false)
    const [currentChapterNumber, setCurrentChapterNumber] = useState(1)
    const { state, updateState, addItem, removeItem, setLocation } = useNovelState()

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3, 4] },
            }),
        ],
        content: `
      <h1>开始你的故事</h1>
      <p>在这里开始写作...</p>
      <p>支持 <strong>Markdown</strong> 语法，包括 <em>斜体</em>、<code>代码</code> 等格式。</p>
    `,
        editorProps: {
            attributes: {
                class: 'prose dark:prose-invert prose-lg max-w-none focus:outline-none min-h-full px-12 py-8',
            },
        },
    })

    // 🔄 监听全局 Store 更新 - 同步创世引擎生成的内容到编辑器
    const shouldUpdateEditor = useNovelStore((state) => state.shouldUpdateEditor)
    const storeContent = useNovelStore((state) => state.content)
    const currentChapter = useNovelStore((state) => state.currentChapter)
    const currentFileId = useNovelStore((state) => state.currentFileId)
    const resetUpdateFlag = useNovelStore((state) => state.resetUpdateFlag)
    const updateContent = useNovelStore((state) => state.updateContent)

    // 🔮 预演功能 Store 状态
    const setPredictions = useNovelStore((state) => state.setPredictions)
    const setActiveLeftTab = useNovelStore((state) => state.setActiveLeftTab)
    const pendingGoal = useNovelStore((state) => state.pendingGoal)
    const setPendingGoal = useNovelStore((state) => state.setPendingGoal)

    // 💾 保存状态管理
    const isDirty = useNovelStore((state) => state.isDirty)
    const setDirty = useNovelStore((state) => state.setDirty)
    const setSaveHandler = useNovelStore((state) => state.setSaveHandler)

    // 🎛️ 写作模式
    const writingMode = useNovelStore((state) => state.writingMode)

    // 🔥 引擎类型（用于跳过启动器）
    const currentEngineType = useNovelStore((state) => state.currentEngineType)

    // 🏛️ 实体发现（被动归档）
    const setDiscoveredEntities = useNovelStore((state) => state.setDiscoveredEntities)
    const currentNovelId = useNovelStore((state) => state.currentNovelId)

    // 保存状态
    const [isSaving, setIsSaving] = useState(false)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)

    // 🚀 章节启动器状态
    const [showLauncher, setShowLauncher] = useState(false)
    const [currentChapterTitle, setCurrentChapterTitle] = useState('')

    // 🔄 自动保存防抖 Timer
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

    // 🏛️ 实体分析防抖 Timer
    const entityAnalysisTimerRef = useRef<NodeJS.Timeout | null>(null)

    // 📂 当文件切换时，从数据库加载最新内容（修复幽灵数据 Bug）
    useEffect(() => {
        async function loadFileContent() {
            if (!currentFileId || !editor) return

            try {
                const file = await getFileById(currentFileId)
                if (file && file.content) {
                    console.log(`[Editor] 加载文件内容: ${file.title}, 长度: ${file.content.length}`)

                    // 强制覆盖编辑器内容为数据库最新版本
                    editor.commands.setContent(file.content)

                    // 同步到 Store
                    updateContent(file.content)

                    // 清除脏标记（刚加载的内容是干净的）
                    setDirty(false)
                }
            } catch (error) {
                console.error('[Editor] 加载文件内容失败:', error)
            }
        }
        loadFileContent()
    }, [currentFileId, editor, updateContent, setDirty])

    // 🚀 检测章节是否为空，显示启动器
    // 监听 currentFileId 和 storeContent 变化来决定是否显示启动器
    // 注意：Viral 模式下跳过启动器
    useEffect(() => {
        async function checkEmptyChapter() {
            // 🔥 Viral 模式跳过章节启动器
            if (currentEngineType === 'viral') {
                setShowLauncher(false)
                return
            }

            if (!currentFileId) {
                setShowLauncher(false)
                return
            }

            try {
                const file = await getFileById(currentFileId)
                if (file && file.type === 'chapter') {
                    // 使用 storeContent (当前内容) 而不是 file.content (数据库内容)
                    const rawContent = storeContent || file.content || ''

                    // 提取实际正文内容（移除标题、摘要、分隔线、占位符等）
                    const bodyContent = extractBodyContent(rawContent)

                    // 判断是否为空章节：正文少于 20 字符
                    const isEmptyChapter = bodyContent.length < 20

                    console.log(`[Launcher] 检测章节: ${file.title}, 原始长度: ${rawContent.trim().length}, 正文长度: ${bodyContent.length}, 显示启动器: ${isEmptyChapter}`)

                    setShowLauncher(isEmptyChapter)
                    setCurrentChapterTitle(file.title)
                } else {
                    setShowLauncher(false)
                }
            } catch (e) {
                console.warn('[Editor] 检查章节失败:', e)
                setShowLauncher(false)
            }
        }
        checkEmptyChapter()
    }, [currentFileId, storeContent, currentEngineType])

    /**
     * 提取章节正文内容（移除元数据行）
     * 移除：标题行、摘要行、分隔线、占位符等
     */
    function extractBodyContent(content: string): string {
        const lines = content.split('\n')
        const bodyLines: string[] = []

        for (const line of lines) {
            const trimmed = line.trim()
            // 跳过：空行、标题行(#)、摘要行(**摘要)、分隔线(---)、占位符(待续写)
            if (
                !trimmed ||
                trimmed.startsWith('#') ||
                trimmed.startsWith('**摘要') ||
                trimmed.startsWith('---') ||
                trimmed.includes('待续写') ||
                trimmed.includes('待补充') ||
                trimmed.includes('(待') ||
                trimmed.includes('（待')
            ) {
                continue
            }
            bodyLines.push(trimmed)
        }

        return bodyLines.join('').trim()
    }


    useEffect(() => {
        if (shouldUpdateEditor && editor && storeContent) {
            console.log('[Editor] 接收到全局 Store 更新，同步内容到编辑器')

            // 构建 HTML 内容
            const title = currentChapter?.title || '第一章'
            const htmlContent = `<h1>第一章 ${title}</h1>${storeContent.split('\n').map(p => p.trim() ? `<p>${p}</p>` : '').join('')}`

            // 更新编辑器内容
            editor.commands.setContent(htmlContent)

            // 重置更新标志
            resetUpdateFlag()

            // 隐藏启动器
            setShowLauncher(false)
        }
    }, [shouldUpdateEditor, storeContent, editor, currentChapter, resetUpdateFlag])

    // 💾 保存函数 - 更新数据库并触发向量化
    const handleSave = useCallback(async () => {
        if (!editor || !currentFileId) {
            console.log('[Editor] 无法保存：没有打开的文件')
            return
        }

        setIsSaving(true)
        try {
            // 获取纯文本内容
            const textContent = editor.getText()

            console.log(`[Editor] 保存文件: ${currentFileId}, 内容长度: ${textContent.length}`)

            // 1️⃣ 更新数据库
            await updateFile(currentFileId, { content: textContent })

            // 2️⃣ 同步到 Store
            updateContent(textContent)

            // 3️⃣ 清除脏标记
            setDirty(false)

            // 4️⃣ 后台触发向量化（暂时禁用 - 需要配置 API Key）
            // TODO: 配置好 OpenAI API Key 后取消注释
            // updateFileEmbedding(currentFileId, textContent).then(() => {
            //     console.log('[Editor] 向量化完成')
            // }).catch(err => {
            //     console.warn('[Editor] 向量化失败:', err)
            // })

            setLastSaved(new Date())
            console.log('[Editor] 保存成功！')

            // 5️⃣ 后台提取世界状态（静默）
            import('@/lib/ai/state-agent').then(({ extractAndUpdateState }) => {
                extractAndUpdateState(textContent).catch(err => {
                    console.warn('[Editor] 状态提取失败:', err)
                })
            })

        } catch (error) {
            console.error('[Editor] 保存失败:', error)
        } finally {
            setIsSaving(false)
        }
    }, [editor, currentFileId, updateContent, setDirty])

    // ⌨️ Ctrl+S 快捷键保存
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                handleSave()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleSave])

    // 📤 注册保存函数到 Store，供其他组件调用（如切换文件时）
    useEffect(() => {
        setSaveHandler(handleSave)
        return () => setSaveHandler(null)
    }, [handleSave, setSaveHandler])

    // 🔄 编辑器内容变化时启动防抖自动保存（3秒）
    useEffect(() => {
        if (!editor) return

        const handleEditorUpdate = () => {
            // 🔄 立即同步到 Store（实时缓存）
            const currentContent = editor.getText()
            updateContent(currentContent)

            // 标记为脏
            setDirty(true)

            // 清除之前的 timer
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current)
            }

            // 2 秒后自动保存到数据库
            autoSaveTimerRef.current = setTimeout(() => {
                handleSave()
            }, 2000)

            // 🏛️ 5 秒后触发实体分析（被动归档）
            if (entityAnalysisTimerRef.current) {
                clearTimeout(entityAnalysisTimerRef.current)
            }
            entityAnalysisTimerRef.current = setTimeout(async () => {
                const text = editor?.getText() || ''
                // 只分析最近 500 字，且内容足够长
                if (text.length > 200) {
                    const recentText = text.slice(-500)
                    try {
                        const result = await analyzeEntities(recentText, currentNovelId)
                        if (result.success && result.entities.length > 0) {
                            setDiscoveredEntities(result.entities.map(e => ({
                                name: e.name,
                                type: e.type,
                                count: e.count,
                                context: e.context
                            })))
                        }
                    } catch (error) {
                        console.warn('[Editor] 实体分析失败:', error)
                    }
                }
            }, 5000)
        }

        editor.on('update', handleEditorUpdate)

        return () => {
            editor.off('update', handleEditorUpdate)
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current)
            }
            if (entityAnalysisTimerRef.current) {
                clearTimeout(entityAnalysisTimerRef.current)
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor, handleSave, setDirty, currentNovelId, setDiscoveredEntities])

    // 获取光标前 200 字符作为起点
    const getContextBeforeCursor = (chars: number = 200): string => {
        if (!editor) return ''
        const { state } = editor
        const { from } = state.selection
        const textBefore = state.doc.textBetween(0, from, '\n', '\n')
        return textBefore.slice(-chars)
    }

    // 自动填充起点 - 当光标位置变化时
    useEffect(() => {
        if (!editor) return

        const updateCurrentState = () => {
            const context = getContextBeforeCursor(200)
            setCommandForm(prev => ({ ...prev, currentState: context }))
        }

        // 初始填充
        updateCurrentState()

        // 监听选区变化
        editor.on('selectionUpdate', updateCurrentState)

        return () => {
            editor.off('selectionUpdate', updateCurrentState)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor])

    // 🎯 监听 pendingGoal 变化 - 从预演卡片应用灵感
    useEffect(() => {
        if (pendingGoal) {
            setCommandForm(prev => ({ ...prev, goal: pendingGoal }))
            setPendingGoal('')  // 清空
            // 显示 Toast 提示
            alert('已应用灵感，请点击生成。')
        }
    }, [pendingGoal, setPendingGoal])

    // 截取内容摘要
    const getSummary = (content: string, maxLen: number = 60): string => {
        if (content.length <= maxLen) return content
        return content.slice(0, maxLen) + '...'
    }

    // 构建节点导航 Prompt
    const buildNavigationPrompt = (memories: RetrievedMemory[]): string => {
        const memoryContext = memories.length > 0
            ? memories.map((m, i) => `[${i + 1}] ${m.content}`).join('\n\n')
            : '（暂无相关历史记忆）'

        return `[Role]
你是一个严格执行大纲的网文写手。

[Task]
请描写一段剧情，严格遵循以下路径：
- 起点：${commandForm.currentState || '（故事开始）'}
- 必须达成的结局：${commandForm.goal}
${commandForm.constraint ? `- 风格约束：${commandForm.constraint}` : ''}

[Memory Context]
${memoryContext}

开始写作：`
    }

    // 处理生成 - 节点导航模式
    const handleGenerate = async () => {
        if (!commandForm.goal.trim()) {
            alert('请填写目标（必须达成的结局）')
            return
        }

        setIsGenerating(true)
        setRetrievedMemories([])
        setCotStatus('searching')
        setCotExpanded(true)

        try {
            // 使用目标作为 RAG 检索的关键词
            const searchQuery = `${commandForm.currentState} ${commandForm.goal}`

            const result = await streamWithRAG({
                instruction: searchQuery,
                novelId: state.currentNovelId || 'default-novel',
                topK: 5,
                similarityThreshold: 0.3,
                systemPrompt: '', // 使用空系统提示，因为我们在 customPromptBuilder 中包含了角色设定
                customPromptBuilder: (_, memories) => buildNavigationPrompt(memories),
                onMemoriesRetrieved: (memories) => {
                    setRetrievedMemories(memories)
                    setCotStatus(memories.length > 0 ? 'found' : 'generating')
                },
                onText: (chunk) => {
                    setCotStatus('generating')
                    if (editor) {
                        editor.commands.insertContent(chunk)
                    }
                },
            })

            setCotStatus('done')
            console.log(`[节点导航] 完成，检索到 ${result.retrievedMemories.length} 条记忆`)

            // 🔥 AI 生成完成后立即保存到数据库
            await handleSave()
            alert('✅ 内容已自动保存')

            // Logic Guard: 分析生成的文本，更新 Codex 状态
            const analysis = analyzeText(result.text)
            if (analysis.hasChanges) {
                console.log(`[LogicGuard] 检测到 ${analysis.changes.length} 个状态变更`)
                applyChanges(state, analysis.changes, {
                    updateState,
                    addItem,
                    removeItem,
                    setLocation
                })
            }

        } catch (error) {
            console.error('节点导航生成失败:', error)
            setCotStatus('error')
            if (error instanceof Error) {
                alert(`生成失败: ${error.message}`)
            }
        } finally {
            setIsGenerating(false)
        }
    }

    // 分支预测 - 灵感生成
    const handleBranchPredict = async () => {
        setIsBrainstorming(true)

        try {
            const context = getContextBeforeCursor(500)
            const codexData = JSON.stringify(state, null, 2)

            const result = await predictPlotBranches(context, codexData)

            // 🔮 同步到全局 Store，供左侧预演 Tab 显示
            const predictions: Prediction[] = result.branches.map(branch => ({
                type: (branch.label === '激进' ? 'aggressive' :
                    branch.label === '稳健' ? 'balanced' : 'surprise') as PredictionType,
                title: branch.title,
                description: branch.description,
            }))
            setPredictions(predictions)

            // 切换到预演标签页
            setActiveLeftTab('previz')

            if (!result.success) {
                console.warn('[分支预测] 使用默认分支:', result.error)
            }
        } catch (error) {
            console.error('[分支预测] 失败:', error)
        } finally {
            setIsBrainstorming(false)
        }
    }

    // 完成本章 - 生成摘要并保存
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleCompleteChapter = async () => {
        if (!editor) return

        const content = editor.getText()
        if (content.length < 200) {
            alert('章节内容过短（至少 200 字），无法生成摘要')
            return
        }

        const chapterTitle = prompt(`请输入第 ${currentChapterNumber} 章标题：`, `第${currentChapterNumber}章`)
        if (!chapterTitle) return

        setIsSavingChapter(true)

        try {
            const chapterId = await saveChapterWithSummary(
                state.currentNovelId || 'default-novel',
                currentChapterNumber,
                chapterTitle,
                content
            )

            if (chapterId) {
                alert(`✅ 第 ${currentChapterNumber} 章已保存，摘要已生成！`)
                setCurrentChapterNumber(prev => prev + 1)
                // 清空编辑器准备新章节
                editor.commands.clearContent()
                editor.commands.setContent(`<h1>${chapterTitle.includes('章') ? '' : '第' + (currentChapterNumber + 1) + '章 '}新章节</h1><p>在这里开始新的章节...</p>`)
            } else {
                alert('保存失败，请重试')
            }
        } catch (error) {
            console.error('[完成本章] 失败:', error)
            alert('保存失败：' + (error instanceof Error ? error.message : '未知错误'))
        } finally {
            setIsSavingChapter(false)
        }
    }

    // 渲染思维链状态图标
    const renderCotStatusIcon = () => {
        switch (cotStatus) {
            case 'searching':
                return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            case 'found':
                return <CheckCircle2 className="h-4 w-4 text-green-500" />
            case 'generating':
                return <Sparkles className="h-4 w-4 animate-pulse text-purple-500" />
            case 'done':
                return <CheckCircle2 className="h-4 w-4 text-green-500" />
            case 'error':
                return <span className="h-4 w-4 text-red-500">✕</span>
            default:
                return <Brain className="h-4 w-4 text-muted-foreground" />
        }
    }

    const renderCotStatusText = () => {
        switch (cotStatus) {
            case 'searching':
                return '正在检索记忆...'
            case 'found':
                return `已关联 ${retrievedMemories.length} 条历史线索`
            case 'generating':
                return 'AI 正在创作...'
            case 'done':
                return `生成完成，使用了 ${retrievedMemories.length} 条记忆`
            case 'error':
                return '生成失败'
            default:
                return '思维链 (Chain of Thought)'
        }
    }

    return (
        <div className="h-full w-full flex flex-col bg-editor relative">
            {/* 🔵 保存状态指示器 + 引擎切换 */}
            <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-border/20 bg-editor">
                {/* 左侧：引擎切换开关 + 试读按钮 */}
                <div className="flex items-center gap-2">
                    <EngineSwitch />
                    <ReaderSandbox />
                </div>

                {/* 右侧：保存状态 */}
                <div className="flex items-center gap-2 text-xs">
                    {isSaving ? (
                        <>
                            <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
                            <span className="text-yellow-500">保存中...</span>
                        </>
                    ) : isDirty ? (
                        <>
                            <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                            <span className="text-orange-400">未保存</span>
                        </>
                    ) : (
                        <>
                            <span className="h-2 w-2 rounded-full bg-green-500" />
                            <span className="text-green-400">已保存</span>
                            {lastSaved && (
                                <span className="text-muted-foreground/50">
                                    {lastSaved.toLocaleTimeString()}
                                </span>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* 🎛️ 流量爆款模式：多巴胺进度条 */}
            {writingMode === 'viral' && (
                <RhythmMonitor content={storeContent || ''} />
            )}

            {/* 🚀 章节启动器 OR 编辑器内容区 */}
            {showLauncher && currentFileId ? (
                <ChapterLauncher
                    chapterId={currentFileId}
                    chapterTitle={currentChapterTitle}
                    onComplete={(content) => {
                        // 将生成的内容填入编辑器
                        if (editor) {
                            const htmlContent = content.split('\n').map(p => p.trim() ? `<p>${p}</p>` : '').join('')
                            editor.commands.setContent(htmlContent)
                        }
                        setShowLauncher(false)
                        // 立即保存
                        handleSave()
                    }}
                    onCancel={() => setShowLauncher(false)}
                />
            ) : (
                <div className="flex-1 overflow-auto">
                    <div className="pb-4">
                        <EditorContent editor={editor} className="h-full w-full tiptap-editor" />

                        {/* 🎛️ 流量爆款模式：无限续写流（跟随内容滚动） */}
                        {writingMode === 'viral' && (
                            <ViralFlow
                                currentContent={storeContent || ''}
                                onTextGenerated={(text) => {
                                    // 将生成的内容追加到编辑器
                                    if (editor) {
                                        const htmlContent = text.split('\n').map(p => p.trim() ? `<p>${p}</p>` : '').join('')
                                        editor.commands.insertContent(htmlContent)
                                        // 标记为已修改
                                        setDirty(true)
                                    }
                                }}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* 指令表单区 */}
            <div className="shrink-0 p-4 bg-editor border-t border-border/30">
                <div className="max-w-4xl mx-auto space-y-3">

                    {/* 思维链面板 */}
                    {(cotStatus !== 'idle' || retrievedMemories.length > 0) && (
                        <div className="rounded-xl bg-card/80 border border-border overflow-hidden">
                            <button
                                onClick={() => setCotExpanded(!cotExpanded)}
                                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-accent/30 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    {renderCotStatusIcon()}
                                    <span className="text-sm font-medium">{renderCotStatusText()}</span>
                                </div>
                                {cotExpanded ? (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                            </button>

                            {cotExpanded && retrievedMemories.length > 0 && (
                                <div className="px-4 pb-3 space-y-2">
                                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                                        <Search className="h-3 w-3" />
                                        <span>检索到的历史片段：</span>
                                    </div>
                                    {retrievedMemories.map((memory, index) => (
                                        <div
                                            key={index}
                                            className="flex items-start gap-2 p-2.5 rounded-lg bg-accent/30 border border-border/50 text-sm"
                                        >
                                            <Database className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-foreground/90 leading-relaxed">
                                                    {getSummary(memory.content, 100)}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    相似度: {(memory.similarity * 100).toFixed(1)}%
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {cotExpanded && cotStatus === 'searching' && (
                                <div className="px-4 pb-3">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>正在数据库中搜索相关历史片段...</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 灵感预测区 */}
                    <div className="rounded-xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/30 p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-purple-400 flex items-center gap-2">
                                <Sparkles className="h-4 w-4" />
                                也就是...
                            </span>
                            <button
                                onClick={handleBranchPredict}
                                disabled={isBrainstorming || isGenerating}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-medium hover:bg-purple-500/30 disabled:opacity-50 transition-all font-sans"
                            >
                                {isBrainstorming ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <Sparkles className="h-3 w-3" />
                                )}
                                {isBrainstorming ? '思考中...' : '✨ 卡文了？帮我想想'}
                            </button>
                        </div>
                    </div>

                    {/* 指令表单 (Command Form) */}
                    <div className="rounded-2xl bg-card/95 backdrop-blur-sm border border-border shadow-2xl shadow-black/20 p-4 space-y-3">

                        {/* 三格输入区 */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                            {/* 🔴 起点 */}
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                    <MapPin className="h-3 w-3 text-red-500" />
                                    起点 (Current State)
                                </label>
                                <textarea
                                    value={commandForm.currentState}
                                    onChange={(e) => setCommandForm({ ...commandForm, currentState: e.target.value })}
                                    placeholder="自动读取光标前 200 字..."
                                    className="w-full h-20 px-3 py-2 text-sm bg-accent/30 border border-border/50 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                                    disabled={isGenerating}
                                />
                            </div>

                            {/* 🟢 目标 (必填) */}
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                    <Target className="h-3 w-3 text-green-500" />
                                    目标 (Goal) <span className="text-red-400">*</span>
                                </label>
                                <textarea
                                    value={commandForm.goal}
                                    onChange={(e) => setCommandForm({ ...commandForm, goal: e.target.value })}
                                    placeholder="必须达成的结局，例如：林冲杀出重围，并在雪地里晕倒"
                                    className="w-full h-20 px-3 py-2 text-sm bg-accent/30 border border-border/50 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                                    disabled={isGenerating}
                                />
                            </div>

                            {/* 🟡 禁忌/风格约束 (选填) */}
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                    <Ban className="h-3 w-3 text-yellow-500" />
                                    禁忌/风格 (Constraint)
                                </label>
                                <textarea
                                    value={commandForm.constraint}
                                    onChange={(e) => setCommandForm({ ...commandForm, constraint: e.target.value })}
                                    placeholder="选填。例如：不要心理描写，动作要快，压抑感"
                                    className="w-full h-20 px-3 py-2 text-sm bg-accent/30 border border-border/50 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                                    disabled={isGenerating}
                                />
                            </div>
                        </div>

                        {/* 按钮区 */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/30">
                            <span className="text-xs text-muted-foreground/50">
                                节点导航模式 · RAG 自动检索相关记忆
                            </span>

                            <div className="flex items-center gap-2">
                                {/* 💾 保存按钮 */}
                                <button
                                    onClick={handleSave}
                                    disabled={isGenerating || isSaving}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-500/20 border border-green-500/40 text-green-400 text-sm font-medium hover:bg-green-500/30 disabled:opacity-50 transition-all"
                                    title="保存到数据库 (Ctrl+S)"
                                >
                                    {isSaving ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <span>💾</span>
                                    )}
                                    <span className="hidden sm:inline">
                                        {isSaving ? '保存中...' : '保存'}
                                    </span>
                                </button>

                                {/* 毒舌读者点评 */}
                                <ReaderSandbox />

                                <button
                                    onClick={handleBranchPredict}
                                    disabled={isGenerating}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/80 disabled:opacity-50 transition-all"
                                    title="分支预测"
                                >
                                    <GitBranch className="h-4 w-4" />
                                    <span className="hidden sm:inline">分支</span>
                                </button>

                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !commandForm.goal.trim()}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                                    title="开始节点导航生成"
                                >
                                    {isGenerating ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Sparkles className="h-4 w-4" />
                                    )}
                                    <span>
                                        {isGenerating ? '生成中...' : '导航生成'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
