"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ScenarioPreview from '@/components/sidebar/scenario-preview'
import DeconstructPanel from '@/components/sidebar/DeconstructPanel'
import {
    Sparkles,
    Folder,
    Zap,
    Wrench,
    FileText,
    ChevronRight,
    ChevronDown,
    Loader2,
    FileType2,
    Award,
    Play,
    CheckCircle2,
    AlertCircle,
    Film,
    Palette,
    Plus
} from 'lucide-react'
import { exportToMarkdown, exportToDocx, generateCreationCertificate } from '@/lib/export'
import { useNovelState } from '@/lib/novel-state'
import { generateNovelStructure, resolveStyleConfig, type GenesisStep } from '@/lib/ai/genesis'
import StyleStudioModal from '@/components/modals/StyleStudioModal'
import { getUserStyles } from '@/lib/actions/styles'
import { useNovelStore, type LeftTabId } from '@/lib/store/novel-store'
import { getAllFiles, createNextChapter, type FileData } from '@/lib/actions/files'
import { createProject } from '@/lib/actions/projects'

// 风格选项类型
interface StyleOption {
    id: string
    name: string
    category: string
    isCustom?: boolean
}

// ========== 创世 Tab ==========
function GenesisTab() {
    const router = useRouter()
    const [idea, setIdea] = useState('')
    const [selectedStyle, setSelectedStyle] = useState('zhihu_revenge')
    const [isGenerating, setIsGenerating] = useState(false)
    const [currentStep, setCurrentStep] = useState<GenesisStep>('idle')
    const [stepMessage, setStepMessage] = useState('')
    const [progress, setProgress] = useState(0)

    const [allStyles, setAllStyles] = useState<StyleOption[]>([])

    // 预设风格
    const presetStyles: StyleOption[] = [
        { id: 'zhihu_revenge', name: '知乎·高爽复仇', category: '都市' },
        { id: 'xuanhuan_classic', name: '经典玄幻', category: '玄幻' },
        { id: 'test_style', name: '测试风格', category: '测试' },
    ]

    // 加载自定义风格
    useEffect(() => {
        async function loadStyles() {
            try {
                const customStyles = await getUserStyles()
                const customOptions: StyleOption[] = customStyles.map(s => ({
                    id: s.id,
                    name: s.name,
                    category: s.category || '自定义',
                    isCustom: true,
                }))
                setAllStyles([...presetStyles, ...customOptions])
            } catch (error) {
                console.error('加载风格失败:', error)
                setAllStyles(presetStyles)
            }
        }
        loadStyles()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleGenesis = async () => {
        if (!idea.trim()) {
            alert('请先输入你的核心脑洞！')
            return
        }

        setIsGenerating(true)
        setCurrentStep('idle')
        setProgress(0)


        try {
            // 1. 创建新项目
            setStepMessage('正在创建项目...')
            const projectTitle = idea.length > 10 ? idea.slice(0, 10) + '...' : idea
            const project = await createProject(projectTitle, 'epic')

            if (!project) {
                throw new Error('创建项目失败')
            }

            // 2. 解析风格配置
            const { stylePrompt, customStyle } = await resolveStyleConfig(selectedStyle)

            // 3. 执行创世 (传入 projectId)
            const genesisResult = await generateNovelStructure(
                idea,
                stylePrompt,
                {
                    onStepChange: (step, message) => {
                        setCurrentStep(step)
                        setStepMessage(message)
                    },
                    onProgress: (percent) => {
                        setProgress(percent)
                    }
                },
                project.id, // Pass projectId
                undefined,
                customStyle
            )


            // 4. 跳转到新项目
            if (genesisResult.success) {
                console.log('[Genesis] 创世完成，跳转到新项目:', project.id)
                router.push(`/editor/${project.id}`)
            }

        } catch (error) {
            console.error('创世失败:', error)
            setCurrentStep('error')
            setStepMessage(error instanceof Error ? error.message : '未知错误')
        } finally {
            setIsGenerating(false)
        }
    }

    const getStepIcon = () => {
        switch (currentStep) {
            case 'generating':
            case 'parsing':
            case 'saving':
                return <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
            case 'done':
                return <CheckCircle2 className="h-4 w-4 text-green-500" />
            case 'error':
                return <AlertCircle className="h-4 w-4 text-red-500" />
            default:
                return <Sparkles className="h-4 w-4 text-muted-foreground" />
        }
    }

    return (
        <div className="p-4 space-y-4">
            {/* 标题 */}
            <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                <h3 className="font-semibold">一键创世</h3>
            </div>

            {/* 风格选择 */}
            <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-medium">风格滤镜</label>
                <select
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    disabled={isGenerating}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                    {(allStyles.length > 0 ? allStyles : presetStyles).map(style => (
                        <option key={style.id} value={style.id}>
                            [{style.category}] {style.name} {style.isCustom ? '✨' : ''}
                        </option>
                    ))}
                </select>
            </div>

            {/* 灵感输入 */}
            <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-medium">核心脑洞</label>
                <textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    disabled={isGenerating}
                    placeholder="输入你的核心创意...&#10;&#10;例如：重生回到高考前一天，前世被欺负的学渣，这一世要让所有看不起他的人后悔"
                    className="w-full h-32 px-3 py-2 text-sm rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 placeholder:text-muted-foreground/50"
                />
            </div>

            {/* 创世按钮 */}
            <button
                onClick={handleGenesis}
                disabled={isGenerating || !idea.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/20"
            >
                {isGenerating ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                    <Play className="h-5 w-5" />
                )}
                <span>{isGenerating ? '创世中...' : '✨ 一键创世'}</span>
            </button>

            {/* 进度显示 */}
            {(isGenerating || currentStep === 'done' || currentStep === 'error') && (
                <div className="space-y-2 p-3 rounded-lg bg-accent/30 border border-border/50">
                    {/* 进度条 */}
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    {/* 状态文字 */}
                    <div className="flex items-center gap-2 text-sm">
                        {getStepIcon()}
                        <span className={currentStep === 'error' ? 'text-red-400' : 'text-muted-foreground'}>
                            {stepMessage || '准备就绪'}
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}

// ========== 资源 Tab ==========
function ProjectTab() {
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['设定集', '章节目录']))
    const [files, setFiles] = useState<FileData[]>([])
    const [isLoading, setIsLoading] = useState(false)

    // 全局 store
    const refreshTrigger = useNovelStore((state) => state.refreshTrigger)
    const currentFileId = useNovelStore((state) => state.currentFileId)
    const setCurrentFile = useNovelStore((state) => state.setCurrentFile)
    const currentProjectId = useNovelStore((state) => state.currentProjectId)

    // 1️⃣ 加载文件列表 - 监听 refreshTrigger 变化时重新加载
    useEffect(() => {
        if (!currentProjectId) return

        async function loadFiles() {
            setIsLoading(true)
            try {
                // 使用 currentProjectId 获取文件
                const allFiles = await getAllFiles(currentProjectId!)
                // 按 order 排序
                const sorted = allFiles.sort((a, b) => (a.order || 0) - (b.order || 0))
                setFiles(sorted)
                console.log(`[ProjectTab] 加载 ${sorted.length} 个文件 (Project: ${currentProjectId})`)
            } catch (error) {
                console.error('[ProjectTab] 加载文件失败:', error)
            } finally {
                setIsLoading(false)
            }
        }
        loadFiles()
    }, [refreshTrigger, currentProjectId])  // 监听 projectId 变化

    // 2️⃣ 按类型分组
    const settingFiles = files.filter(f =>
        f.type === 'setting' || f.type === 'worldview' || f.type === 'outline'
    )
    const chapterFiles = files.filter(f => f.type === 'chapter')

    const toggleFolder = (folder: string) => {
        const newExpanded = new Set(expandedFolders)
        if (newExpanded.has(folder)) {
            newExpanded.delete(folder)
        } else {
            newExpanded.add(folder)
        }
        setExpandedFolders(newExpanded)
    }

    const handleFileClick = async (file: FileData) => {
        const { isDirty, saveHandler } = useNovelStore.getState()

        if (isDirty && saveHandler) {
            console.log('[ProjectTab] 切换前保存当前文件...')
            await saveHandler()
        }

        setCurrentFile(file.id, file.content)
    }

    const getFileColor = (type: string) => {
        switch (type) {
            case 'worldview': return 'text-purple-400'
            case 'chapter': return 'text-blue-400'
            case 'outline': return 'text-green-400'
            case 'setting': return 'text-amber-400'
            default: return 'text-gray-400'
        }
    }

    // 🆕 新建章节处理函数
    const handleAddChapter = async () => {
        if (!currentProjectId) {
            console.warn('[ProjectTab] 无法创建章节：未选择项目')
            return
        }

        try {
            console.log('[ProjectTab] 创建新章节...')
            const newChapter = await createNextChapter(currentProjectId)

            if (newChapter) {
                console.log(`[ProjectTab] 新章节创建成功: ${newChapter.title}`)

                // 刷新文件列表
                const allFiles = await getAllFiles(currentProjectId)
                const sorted = allFiles.sort((a, b) => (a.order || 0) - (b.order || 0))
                setFiles(sorted)

                // 自动选中新章节
                setCurrentFile(newChapter.id, newChapter.content)
            }
        } catch (error) {
            console.error('[ProjectTab] 创建章节失败:', error)
        }
    }

    const renderFileItem = (file: FileData, level = 1) => {
        const isSelected = currentFileId === file.id
        return (
            <button
                key={file.id}
                onClick={() => handleFileClick(file)}
                className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded transition-colors ${isSelected
                    ? 'bg-purple-500/20 text-purple-300 font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    }`}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
            >
                <FileText className={`h-4 w-4 shrink-0 ${getFileColor(file.type)}`} />
                <span className="truncate">{file.title}</span>
            </button>
        )
    }

    const renderFolder = (
        name: string,
        emoji: string,
        fileList: FileData[],
        folderColor: string,
        onAdd?: () => void  // 新增：添加按钮回调
    ) => {
        const isExpanded = expandedFolders.has(name)
        if (fileList.length === 0 && !onAdd) return null

        return (
            <div key={name}>
                <div className="flex items-center gap-0.5">
                    <button
                        onClick={() => toggleFolder(name)}
                        className="flex-1 flex items-center gap-1.5 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded transition-colors"
                        style={{ paddingLeft: '8px' }}
                    >
                        {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <Folder className={`h-4 w-4 shrink-0 ${folderColor}`} />
                        <span className="truncate">{emoji} {name}</span>
                        <span className="ml-auto text-xs text-muted-foreground bg-accent/50 px-1.5 rounded">
                            {fileList.length}
                        </span>
                    </button>
                    {onAdd && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                onAdd()
                            }}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded transition-colors"
                            title="新建章节"
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                {isExpanded && (
                    <div className="space-y-0.5">
                        {fileList.map(file => renderFileItem(file))}
                    </div>
                )}
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="p-4 flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
                <span className="text-sm text-muted-foreground">加载中...</span>
            </div>
        )
    }

    if (!currentProjectId) {
        return (
            <div className="p-4 text-center">
                <p className="text-sm text-muted-foreground">未选择项目</p>
            </div>
        )
    }

    if (files.length === 0) {
        return (
            <div className="p-4 text-center">
                <div className="text-3xl mb-2">📂</div>
                <p className="text-sm text-muted-foreground">还没有项目文件</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                    可以在&quot;创世&quot;中生成，或手动添加
                </p>
            </div>
        )
    }

    return (
        <div className="p-2 space-y-1">
            <div className="flex items-center gap-1.5 px-2 py-2 text-sm font-semibold border-b border-border/50 mb-2">
                <Folder className="h-4 w-4 text-amber-500" />
                <span>项目文件</span>
                <span className="ml-auto text-xs text-muted-foreground font-normal">
                    {files.length}
                </span>
            </div>

            {renderFolder('设定集', '🌍', settingFiles, 'text-amber-500')}
            {renderFolder('章节目录', '📖', chapterFiles, 'text-blue-500', handleAddChapter)}
        </div>
    )
}

// ========== 工具 Tab ==========
function ToolsTab() {
    const { state } = useNovelState()
    const [isExporting, setIsExporting] = useState<string | null>(null)
    const [showStyleStudio, setShowStyleStudio] = useState(false)

    const handleExport = async (format: 'md' | 'docx' | 'certificate') => {
        setIsExporting(format)
        const novelId = state.currentNovelId || 'default-novel'
        const novelTitle = '我的小说'

        try {
            switch (format) {
                case 'md':
                    await exportToMarkdown(novelId, novelTitle)
                    break
                case 'docx':
                    await exportToDocx(novelId, novelTitle)
                    break
                case 'certificate':
                    await generateCreationCertificate(novelId, novelTitle, '匿名作者')
                    break
            }
        } catch (error) {
            console.error('导出失败:', error)
            alert('导出失败: ' + (error instanceof Error ? error.message : '未知错误'))
        } finally {
            setIsExporting(null)
        }
    }

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <Wrench className="h-5 w-5 text-gray-500" />
                <h3 className="font-semibold">工具箱</h3>
            </div>

            <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">📥 导出发布</p>

                <button
                    onClick={() => handleExport('md')}
                    disabled={isExporting !== null}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors disabled:opacity-50"
                >
                    {isExporting === 'md' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 text-blue-500" />}
                    <span>导出 Markdown</span>
                </button>

                <button
                    onClick={() => handleExport('docx')}
                    disabled={isExporting !== null}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors disabled:opacity-50"
                >
                    {isExporting === 'docx' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileType2 className="h-4 w-4 text-indigo-500" />}
                    <span>导出 Word 文档</span>
                </button>

                <button
                    onClick={() => handleExport('certificate')}
                    disabled={isExporting !== null}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors disabled:opacity-50"
                >
                    {isExporting === 'certificate' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
                    <span>生成创作证书</span>
                </button>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground font-medium">🎬 格式转换</p>

                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors">
                    <Film className="h-4 w-4 text-pink-500" />
                    <span>转换为短剧脚本</span>
                    <span className="ml-auto text-xs text-muted-foreground">即将推出</span>
                </button>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground font-medium">🎨 风格工坊</p>

                <button
                    onClick={() => setShowStyleStudio(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 text-purple-400 transition-all"
                >
                    <Palette className="h-4 w-4" />
                    <span>创建伪 LoRA 风格</span>
                </button>
            </div>

            <StyleStudioModal
                isOpen={showStyleStudio}
                onClose={() => setShowStyleStudio(false)}
            />
        </div>
    )
}

// ========== 主组件 ==========
export default function LeftSidebar() {
    const activeTab = useNovelStore((state) => state.activeLeftTab)
    const setActiveTab = useNovelStore((state) => state.setActiveLeftTab)

    const tabs = [
        { id: 'genesis' as LeftTabId, icon: Sparkles, label: '创世', color: 'text-purple-500' },
        { id: 'project' as LeftTabId, icon: Folder, label: '资源', color: 'text-amber-500' },
        { id: 'previz' as LeftTabId, icon: Zap, label: '预演', color: 'text-yellow-500' },
        { id: 'deconstruct' as LeftTabId, icon: Film, label: '拆解', color: 'text-orange-500' },
        { id: 'tools' as LeftTabId, icon: Wrench, label: '工具', color: 'text-gray-500' },
    ]

    return (
        <div className="h-full flex flex-col bg-card/50">
            {/* Tab 导航 */}
            <div className="flex border-b border-border">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${activeTab === tab.id
                            ? `${tab.color} bg-accent/50`
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
                            }`}
                    >
                        <tab.icon className="h-4 w-4" />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab 内容 */}
            <div className="flex-1 overflow-auto">
                {activeTab === 'genesis' && <GenesisTab />}
                {activeTab === 'project' && <ProjectTab />}
                {activeTab === 'previz' && <ScenarioPreview />}
                {activeTab === 'deconstruct' && <DeconstructPanel />}
                {activeTab === 'tools' && <ToolsTab />}
            </div>
        </div>
    )
}
