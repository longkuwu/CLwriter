"use client"

import { useState, useCallback, useEffect, useRef } from 'react'
import {
    Dna,
    Sparkles,
    Loader2,
    ChevronRight,
    ChevronLeft,
    Copy,
    Check,
    TrendingUp,
    Lightbulb,
    Zap,
    Palette,
    Upload,
    FileText,
    AlertTriangle,
    Layers,
    Cpu,
    Rocket,
    BookOpen,
    Play,
    FolderPlus
} from 'lucide-react'
import {
    deconstructArticle,
    generateImitation,
    type DeconstructResult,
    calculateRhythmMatch
} from '@/lib/ai/viral-agent'
import {
    analyzeText,
    type StructureAnalysis,
    type BeatItem
} from '@/lib/ai/deconstruct-agent'
import {
    remapSkeleton,
    batchCreateChapters,
    autoSerialize,
    type RemappedBeat,
    type SerializationState
} from '@/lib/ai/imitation-agent'
import {
    LONG_TEXT_THRESHOLD,
    MEGA_TEXT_THRESHOLD,
    getAnalysisMode,
    getAnalysisModeLabel,
    type AnalysisMode
} from '@/lib/constants'
import { getUserStyles, type UserStyle, buildFewShotUserPrompt } from '@/lib/actions/styles'
import { useNovelStore } from '@/lib/store/novel-store'
import { cn } from '@/lib/utils'
import { chunkText, readFileContent, formatWordCount, type TextMetadata } from '@/lib/utils/chunker'

type Step = 1 | 2 | 3

// 平台类型
type PlatformType = 'tomato' | 'zhihu' | 'toutiao'

const PLATFORMS: { id: PlatformType; icon: string; name: string; description: string }[] = [
    { id: 'tomato', icon: '🍅', name: '番茄/百度', description: '黄金三章、爽点密度、打脸节奏' },
    { id: 'zhihu', icon: '🧂', name: '知乎/公众号', description: '第一人称、反转钩子、社会痛点' },
    { id: 'toutiao', icon: '📰', name: '头条/故事', description: '猎奇开头、情绪煽动' },
]

/**
 * 拆解仿写面板 - Viral 模式核心功能
 * 
 * 三步流程：
 * 1. 拆解爆文结构（支持文件上传和超长文本）
 * 2. 注入主题/风格（支持自定义 LoRA 胶囊）
 * 3. 生成仿写
 */
export default function DeconstructPanel() {
    const [step, setStep] = useState<Step>(1)
    const [referenceText, setReferenceText] = useState('')
    const [isDeconstructing, setIsDeconstructing] = useState(false)
    const [deconstructResult, setDeconstructResult] = useState<DeconstructResult | null>(null)

    // 长文本分析结果
    const [structureAnalysis, setStructureAnalysis] = useState<StructureAnalysis | null>(null)
    const [analysisProgress, setAnalysisProgress] = useState<{ step: string; progress: number } | null>(null)

    // 新增：平台选择和长文本支持
    const [selectedPlatform, setSelectedPlatform] = useState<PlatformType>('tomato')
    const [textMetadata, setTextMetadata] = useState<TextMetadata | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Step 2 配置
    const [topic, setTopic] = useState('')
    const [selectedStyleId, setSelectedStyleId] = useState<string>('')
    const [customStyles, setCustomStyles] = useState<UserStyle[]>([])
    const [isLoadingStyles, setIsLoadingStyles] = useState(false)

    // Step 3 生成（短文模式）
    const [isGenerating, setIsGenerating] = useState(false)
    const [generatedContent, setGeneratedContent] = useState('')
    const [rhythmMatch, setRhythmMatch] = useState<number | null>(null)

    // Step 3 生成（长文模式）
    const [remappedBeats, setRemappedBeats] = useState<RemappedBeat[]>([])
    const [createdChapters, setCreatedChapters] = useState<Array<{ fileId: string; chapterNumber: number; title: string }>>([])
    const [serializationState, setSerializationState] = useState<SerializationState | null>(null)
    const [isCreatingChapters, setIsCreatingChapters] = useState(false)

    const updateContent = useNovelStore((state) => state.updateContent)
    const triggerUpdate = useNovelStore((state) => state.triggerUpdate)
    const currentProjectId = useNovelStore((state) => state.currentProjectId)

    // 三级分析模式判定
    const analysisMode: AnalysisMode = getAnalysisMode(referenceText.length)
    const modeLabel = getAnalysisModeLabel(analysisMode)

    // 兼容性：长文本模式 = smart 或 mega
    const isLongTextMode = analysisMode !== 'lite'

    // 实时更新文本元数据
    useEffect(() => {
        if (referenceText.length > 0) {
            const result = chunkText(referenceText)
            setTextMetadata(result.metadata)
        } else {
            setTextMetadata(null)
        }
    }, [referenceText])

    // 处理文件上传
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            const content = await readFileContent(file)
            setReferenceText(content)
        } catch (error) {
            alert(error instanceof Error ? error.message : '文件读取失败')
        }
    }

    // 加载自定义风格胶囊
    useEffect(() => {
        async function loadStyles() {
            setIsLoadingStyles(true)
            try {
                const styles = await getUserStyles()
                setCustomStyles(styles)
            } catch (error) {
                console.error('加载风格失败:', error)
            } finally {
                setIsLoadingStyles(false)
            }
        }
        loadStyles()
    }, [])

    // Step 1: 拆解（自适应分流）
    const handleDeconstruct = async () => {
        if (!referenceText.trim() || referenceText.length < 200) {
            alert('请输入至少 200 字的参考文章')
            return
        }

        setIsDeconstructing(true)
        setAnalysisProgress(null)

        try {
            if (isLongTextMode) {
                // �/�🟣 智能/宏观模式 - 长文本分析
                console.log(`[Deconstruct] 启用${modeLabel.name}，长度:`, referenceText.length)

                const analysis = await analyzeText(
                    referenceText,
                    selectedPlatform,
                    (step, progress) => {
                        setAnalysisProgress({ step, progress })
                    }
                )

                if (analysis) {
                    setStructureAnalysis(analysis)
                    // 将动态骨架转换为 DeconstructResult 格式以兼容后续流程
                    const convertedResult: DeconstructResult = {
                        structure: analysis.beats.map(b => ({
                            stage: b.beat,
                            wordCount: b.wordCount,
                            description: b.function
                        })),
                        moodCurve: analysis.beats.map(b => ({
                            position: `第${b.chapter}章`,
                            mood: b.mood,
                            intensity: getMoodIntensity(b.mood)
                        })),
                        techniques: analysis.macro.keyTurns,
                        summary: analysis.macro.corePlot
                    }
                    setDeconstructResult(convertedResult)
                    setStep(2)
                } else {
                    alert('长文分析失败，请重试')
                }
            } else {
                // 🟢 轻量模式 (Lite Mode) - 短文快速分析
                console.log('[Deconstruct] 启用轻量模式，长度:', referenceText.length)

                const result = await deconstructArticle(referenceText)
                if (result) {
                    setDeconstructResult(result)
                    setStep(2)
                } else {
                    alert('拆解失败，请重试')
                }
            }
        } catch (error) {
            console.error('拆解失败:', error)
            alert('拆解失败：' + (error instanceof Error ? error.message : '未知错误'))
        } finally {
            setIsDeconstructing(false)
            setAnalysisProgress(null)
        }
    }

    // 情绪强度映射
    function getMoodIntensity(mood: string): number {
        const intensityMap: Record<string, number> = {
            '压抑': 3, '期待': 5, '震惊': 7, '爽': 9, '燃': 10,
            '感动': 8, '好奇': 4, '愤怒': 8, '解气': 9, '意外': 6
        }
        return intensityMap[mood] || 5
    }

    // Step 3: 生成仿写（模式分流）
    const handleGenerate = async () => {
        if (!topic.trim()) {
            alert('请输入创作主题')
            return
        }
        if (!deconstructResult) {
            alert('请先完成拆解')
            return
        }

        setStep(3)

        if (isLongTextMode) {
            // === 长文模式：骨架重绘 + 批量建章 ===
            await handleLongModeGenerate()
        } else {
            // === 短文模式：直接流式输出 ===
            await handleShortModeGenerate()
        }
    }

    // 短文模式生成
    const handleShortModeGenerate = async () => {
        setIsGenerating(true)
        setGeneratedContent('')

        try {
            // 找到选中的自定义风格
            const selectedStyle = selectedStyleId
                ? customStyles.find(s => s.id === selectedStyleId)
                : null

            // 构建风格指导（包含 few-shot 样本）
            let styleGuideText = ''
            if (selectedStyle) {
                styleGuideText = `【风格：${selectedStyle.name}】\n${selectedStyle.coreInstruction}\n`

                // 注入 Few-Shot 样本进行 In-Context Learning
                if (selectedStyle.fewShotExamples.length > 0) {
                    styleGuideText += `\n【参考范文片段（请模仿这些文字的风格和语感）】\n`
                    selectedStyle.fewShotExamples.forEach((ex, i) => {
                        styleGuideText += `--- 范例${i + 1} (${ex.context}) ---\n${ex.example}\n\n`
                    })
                }

                if (selectedStyle.negativePrompt) {
                    styleGuideText += `\n【禁止事项】${selectedStyle.negativePrompt}\n`
                }
            }

            const content = await generateImitation(
                {
                    structure: deconstructResult!.structure,
                    moodCurve: deconstructResult!.moodCurve,
                    topic,
                    styleGuide: styleGuideText || undefined
                },
                (chunk) => {
                    setGeneratedContent(prev => prev + chunk)
                }
            )

            // 计算节奏吻合度
            const match = calculateRhythmMatch(deconstructResult!.structure, content)
            setRhythmMatch(match)

        } catch (error) {
            console.error('生成失败:', error)
            alert('生成失败：' + (error instanceof Error ? error.message : '未知错误'))
        } finally {
            setIsGenerating(false)
        }
    }

    // 长文模式生成（骨架重绘）
    const handleLongModeGenerate = async () => {
        if (!structureAnalysis) {
            alert('长文分析结果缺失')
            return
        }

        setIsGenerating(true)
        setRemappedBeats([])

        try {
            // 从 structureAnalysis 中提取原作主题
            const originalTheme = structureAnalysis.macro.corePlot || '原作主题'

            // 骨架重绘
            const remapped = await remapSkeleton(
                structureAnalysis.beats,
                originalTheme,
                topic,
                1.0  // 默认 1:1 比例
            )

            setRemappedBeats(remapped)
            console.log(`[Deconstruct] 骨架重绘完成，共 ${remapped.length} 章`)

        } catch (error) {
            console.error('骨架重绘失败:', error)
            alert('骨架重绘失败：' + (error instanceof Error ? error.message : '未知错误'))
        } finally {
            setIsGenerating(false)
        }
    }

    // 批量创建章节
    const handleCreateChapters = async () => {
        if (!currentProjectId) {
            alert('请先选择项目')
            return
        }
        if (remappedBeats.length === 0) {
            alert('请先完成骨架重绘')
            return
        }

        setIsCreatingChapters(true)

        try {
            const result = await batchCreateChapters(currentProjectId, remappedBeats)

            if (result.success) {
                setCreatedChapters(result.chapters)
                alert(`成功创建 ${result.chapters.length} 个章节！`)
            } else {
                alert('部分章节创建失败')
            }
        } catch (error) {
            console.error('批量创建失败:', error)
            alert('批量创建失败：' + (error instanceof Error ? error.message : '未知错误'))
        } finally {
            setIsCreatingChapters(false)
        }
    }

    // 启动自动连载
    const handleStartSerialization = async () => {
        if (createdChapters.length === 0) {
            alert('请先创建章节')
            return
        }

        // 找到选中的自定义风格
        const selectedStyle = selectedStyleId
            ? customStyles.find(s => s.id === selectedStyleId)
            : null

        let styleGuideText = ''
        if (selectedStyle) {
            styleGuideText = `【风格：${selectedStyle.name}】\n${selectedStyle.coreInstruction}`
        }

        try {
            await autoSerialize(
                createdChapters,
                remappedBeats,
                styleGuideText,
                (state) => {
                    setSerializationState(state)
                },
                (chapterNum, content) => {
                    console.log(`[Serialize] 第 ${chapterNum} 章完成，${content.length} 字`)
                }
            )
        } catch (error) {
            console.error('自动连载失败:', error)
            alert('自动连载失败：' + (error instanceof Error ? error.message : '未知错误'))
        }
    }

    // 将生成内容填入编辑器
    const handleApplyToEditor = () => {
        if (generatedContent) {
            updateContent(generatedContent)
            triggerUpdate()
        }
    }

    // 计算长文模式预估字数
    const estimatedTotalWords = remappedBeats.reduce((sum, b) => sum + b.targetWordCount, 0)

    return (
        <div className="h-full flex flex-col">
            {/* 标题 */}
            <div className="px-4 py-3 border-b border-border/50 bg-gradient-to-r from-orange-500/10 to-red-500/10">
                <div className="flex items-center gap-2">
                    <Dna className="h-5 w-5 text-orange-400" />
                    <h3 className="font-bold text-foreground">拆解仿写</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    分析爆文结构，一键生成仿写
                </p>
            </div>

            {/* 步骤指示器 */}
            <div className="px-4 py-3 border-b border-border/30 flex items-center justify-center gap-2">
                {[1, 2, 3].map((s) => (
                    <div key={s} className="flex items-center">
                        <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
                            step >= s
                                ? "bg-orange-500 text-white"
                                : "bg-muted text-muted-foreground"
                        )}>
                            {s}
                        </div>
                        {s < 3 && (
                            <div className={cn(
                                "w-8 h-0.5 mx-1",
                                step > s ? "bg-orange-500" : "bg-muted"
                            )} />
                        )}
                    </div>
                ))}
            </div>

            {/* 内容区 */}
            <div className="flex-1 overflow-auto p-4">
                {/* ========== Step 1: 拆解 ========== */}
                {step === 1 && (
                    <div className="space-y-4">
                        {/* 平台选择器 */}
                        <div>
                            <label className="text-sm font-medium mb-2 flex items-center gap-1">
                                <Layers className="h-4 w-4 text-orange-400" />
                                来源平台（分析模型）
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {PLATFORMS.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => setSelectedPlatform(p.id)}
                                        className={cn(
                                            "p-2 rounded-lg border text-center transition-all",
                                            selectedPlatform === p.id
                                                ? "border-orange-500 bg-orange-500/10"
                                                : "border-border hover:border-orange-500/50"
                                        )}
                                    >
                                        <span className="text-lg">{p.icon}</span>
                                        <p className="text-[10px] font-medium mt-1">{p.name}</p>
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">
                                {PLATFORMS.find(p => p.id === selectedPlatform)?.description}
                            </p>
                        </div>

                        {/* 输入区：文本框 + 文件上传 */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium flex items-center gap-1">
                                    📝 粘贴对标爆文
                                </label>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent/50 transition-colors"
                                >
                                    <Upload className="h-3 w-3" />
                                    上传文件
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".txt,.md"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                            </div>
                            <textarea
                                value={referenceText}
                                onChange={(e) => setReferenceText(e.target.value)}
                                placeholder="将你想模仿的爆文正文粘贴到这里...&#10;&#10;支持知乎、番茄、起点等平台的文章&#10;或点击右上角上传 .txt / .md 文件"
                                className="w-full h-48 p-3 text-sm bg-accent/30 border border-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                            />

                            {/* 字数统计和元数据 */}
                            <div className="mt-2 space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">
                                        字数：{formatWordCount(referenceText.length)}
                                    </span>
                                    {textMetadata && textMetadata.estimatedChapters > 1 && (
                                        <span className="text-muted-foreground">
                                            约 {textMetadata.estimatedChapters} 章节
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 模式指示器 */}
                        {referenceText.length >= 200 && (
                            <div className={cn(
                                "flex items-start gap-2 p-3 rounded-xl border",
                                analysisMode === 'mega'
                                    ? "bg-purple-500/10 border-purple-500/30"
                                    : analysisMode === 'smart'
                                        ? "bg-yellow-500/10 border-yellow-500/30"
                                        : "bg-green-500/10 border-green-500/30"
                            )}>
                                {analysisMode === 'mega' ? (
                                    <Rocket className="h-4 w-4 text-purple-400 flex-shrink-0 mt-0.5" />
                                ) : analysisMode === 'smart' ? (
                                    <Zap className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                                ) : (
                                    <Cpu className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                                )}
                                <div>
                                    <p className={cn(
                                        "text-xs font-medium",
                                        analysisMode === 'mega' ? "text-purple-400" :
                                            analysisMode === 'smart' ? "text-yellow-400" : "text-green-400"
                                    )}>
                                        {modeLabel.icon} {modeLabel.name}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        {modeLabel.description}
                                    </p>
                                    {textMetadata && analysisMode !== 'lite' && (
                                        <p className={cn(
                                            "text-[10px] mt-1",
                                            analysisMode === 'mega' ? "text-purple-400/70" : "text-yellow-400/70"
                                        )}>
                                            预计切分 {textMetadata.totalChunks} 块 · {textMetadata.estimatedChapters} 章节
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 分析进度条 */}
                        {analysisProgress && isDeconstructing && (
                            <div className="space-y-2 p-3 bg-accent/30 rounded-xl">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">{analysisProgress.step}</span>
                                    <span className="text-orange-400 font-medium">{analysisProgress.progress}%</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-300"
                                        style={{ width: `${analysisProgress.progress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleDeconstruct}
                            disabled={isDeconstructing || referenceText.length < 200}
                            className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isDeconstructing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {textMetadata?.isLongContent ? '分块拆解中...' : 'AI 正在拆解...'}
                                </>
                            ) : (
                                <>
                                    <Dna className="h-4 w-4" />
                                    {textMetadata?.isLongContent ? '开始分块拆解' : '开始拆解'}
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* ========== Step 2: 配置 ========== */}
                {step === 2 && deconstructResult && (
                    <div className="space-y-4">
                        {/* 拆解结果展示 */}
                        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                            <div className="flex items-center gap-2 mb-2">
                                <Check className="h-4 w-4 text-green-500" />
                                <span className="text-sm font-medium text-green-400">拆解成功</span>
                            </div>

                            {/* 节奏骨架 */}
                            <div className="mb-3">
                                <p className="text-xs text-muted-foreground mb-1">📐 节奏骨架：</p>
                                <div className="space-y-1">
                                    {deconstructResult.structure.map((s, i) => (
                                        <div key={i} className="text-xs text-foreground/80">
                                            → {s.stage} ({s.wordCount}字)
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 情绪曲线 */}
                            <div className="mb-3">
                                <p className="text-xs text-muted-foreground mb-1">📈 情绪曲线：</p>
                                <div className="flex flex-wrap gap-1">
                                    {deconstructResult.moodCurve.map((m, i) => (
                                        <span
                                            key={i}
                                            className={cn(
                                                "px-2 py-0.5 text-[10px] rounded-full",
                                                m.intensity >= 7
                                                    ? "bg-red-500/20 text-red-400"
                                                    : m.intensity >= 4
                                                        ? "bg-yellow-500/20 text-yellow-400"
                                                        : "bg-blue-500/20 text-blue-400"
                                            )}
                                        >
                                            {m.mood}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* 核心套路 */}
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">💡 核心套路：</p>
                                <p className="text-xs text-foreground/70">{deconstructResult.summary}</p>
                            </div>
                        </div>

                        {/* 主题输入 */}
                        <div>
                            <label className="text-sm font-medium mb-2 flex items-center gap-1">
                                <Lightbulb className="h-4 w-4 text-yellow-400" />
                                主题/热点
                            </label>
                            <input
                                type="text"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="例：重生之我是麻辣烫摊主..."
                                className="w-full px-3 py-2 text-sm bg-accent/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                            />
                        </div>

                        {/* 风格胶囊选择器 */}
                        <div>
                            <label className="text-sm font-medium mb-2 flex items-center gap-1">
                                <Palette className="h-4 w-4 text-purple-400" />
                                自定义 LoRA 风格
                            </label>
                            <select
                                value={selectedStyleId}
                                onChange={(e) => setSelectedStyleId(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-accent/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                            >
                                <option value="">不使用自定义风格</option>
                                {isLoadingStyles ? (
                                    <option disabled>加载中...</option>
                                ) : (
                                    customStyles.map(style => (
                                        <option key={style.id} value={style.id}>
                                            {style.name} ({style.fewShotExamples.length} 样本)
                                        </option>
                                    ))
                                )}
                            </select>
                            {selectedStyleId && customStyles.find(s => s.id === selectedStyleId) && (
                                <div className="mt-2 p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                                    <p className="text-[10px] text-purple-400">
                                        ✨ 已选风格将注入 {customStyles.find(s => s.id === selectedStyleId)?.fewShotExamples.length || 0} 段范文样本进行 In-Context Learning
                                    </p>
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                                💡 在"工具"标签页的"风格工坊"中创建自定义风格
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setStep(1)}
                                className="flex-1 py-2.5 text-sm border border-border rounded-xl hover:bg-accent transition-colors flex items-center justify-center gap-1"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                返回
                            </button>
                            <button
                                onClick={handleGenerate}
                                disabled={!topic.trim()}
                                className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <Sparkles className="h-4 w-4" />
                                开始仿写
                            </button>
                        </div>
                    </div>
                )}

                {/* ========== Step 3: 生成结果 ========== */}
                {step === 3 && (
                    <div className="space-y-4">
                        {/* 生成状态 */}
                        {isGenerating && (
                            <div className="flex items-center gap-2 p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                                <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                                <span className="text-sm text-orange-400">
                                    {isLongTextMode ? '正在骨架重绘...' : 'AI 正在创作...'}
                                </span>
                            </div>
                        )}

                        {/* ========== 短文模式结果 ========== */}
                        {!isLongTextMode && (
                            <>
                                {/* 节奏吻合度 */}
                                {rhythmMatch !== null && (
                                    <div className="p-3 bg-accent/30 border border-border rounded-xl">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <TrendingUp className="h-3 w-3" />
                                                节奏吻合度
                                            </span>
                                            <span className={cn(
                                                "text-sm font-bold",
                                                rhythmMatch >= 80 ? "text-green-400" :
                                                    rhythmMatch >= 60 ? "text-yellow-400" : "text-orange-400"
                                            )}>
                                                {rhythmMatch}%
                                            </span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className={cn(
                                                    "h-full rounded-full transition-all duration-500",
                                                    rhythmMatch >= 80 ? "bg-green-500" :
                                                        rhythmMatch >= 60 ? "bg-yellow-500" : "bg-orange-500"
                                                )}
                                                style={{ width: `${rhythmMatch}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* 生成内容预览 */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block">
                                        📄 生成内容（{generatedContent.length} 字）
                                    </label>
                                    <div className="h-48 p-3 text-sm bg-accent/30 border border-border rounded-xl overflow-auto whitespace-pre-wrap">
                                        {generatedContent || '生成中...'}
                                    </div>
                                </div>

                                {/* 操作按钮 */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setStep(2)}
                                        className="flex-1 py-2.5 text-sm border border-border rounded-xl hover:bg-accent transition-colors flex items-center justify-center gap-1"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        重新配置
                                    </button>
                                    <button
                                        onClick={handleApplyToEditor}
                                        disabled={!generatedContent || isGenerating}
                                        className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        <Copy className="h-4 w-4" />
                                        填入编辑器
                                    </button>
                                </div>
                            </>
                        )}

                        {/* ========== 长文模式结果 ========== */}
                        {isLongTextMode && (
                            <>
                                {/* 骨架重绘结果信息 */}
                                {remappedBeats.length > 0 && (
                                    <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl space-y-3">
                                        <div className="flex items-center gap-2">
                                            <BookOpen className="h-5 w-5 text-purple-400" />
                                            <span className="font-medium text-purple-400">骨架重绘完成</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div className="p-2 bg-background/50 rounded-lg">
                                                <p className="text-muted-foreground text-xs">解析章节数</p>
                                                <p className="text-xl font-bold text-foreground">{remappedBeats.length}</p>
                                            </div>
                                            <div className="p-2 bg-background/50 rounded-lg">
                                                <p className="text-muted-foreground text-xs">预估字数</p>
                                                <p className="text-xl font-bold text-foreground">
                                                    {(estimatedTotalWords / 10000).toFixed(1)} 万
                                                </p>
                                            </div>
                                        </div>

                                        {/* 章节列表预览 */}
                                        <div className="max-h-32 overflow-auto text-xs space-y-1">
                                            {remappedBeats.slice(0, 10).map((beat, i) => (
                                                <div key={i} className="flex items-center justify-between p-1.5 bg-background/30 rounded">
                                                    <span className="text-muted-foreground">第{beat.chapter}章</span>
                                                    <span className="text-foreground truncate max-w-[150px]">{beat.newBeat}</span>
                                                    <span className="text-muted-foreground">{beat.targetWordCount}字</span>
                                                </div>
                                            ))}
                                            {remappedBeats.length > 10 && (
                                                <p className="text-center text-muted-foreground">...还有 {remappedBeats.length - 10} 章</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 批量创建章节按钮 */}
                                {remappedBeats.length > 0 && createdChapters.length === 0 && (
                                    <button
                                        onClick={handleCreateChapters}
                                        disabled={isCreatingChapters}
                                        className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isCreatingChapters ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                创建中...
                                            </>
                                        ) : (
                                            <>
                                                <FolderPlus className="h-4 w-4" />
                                                开始批量创建章节
                                            </>
                                        )}
                                    </button>
                                )}

                                {/* 章节创建成功后显示自动连载按钮 */}
                                {createdChapters.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-2">
                                            <Check className="h-4 w-4 text-green-400" />
                                            <span className="text-sm text-green-400">
                                                已创建 {createdChapters.length} 个章节文件
                                            </span>
                                        </div>

                                        {/* 自动连载进度 */}
                                        {serializationState?.isRunning && (
                                            <div className="p-3 bg-accent/30 rounded-xl space-y-2">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-muted-foreground">
                                                        正在生成第 {serializationState.currentChapter}/{serializationState.totalChapters} 章
                                                    </span>
                                                    <span className="text-orange-400 font-medium">
                                                        {Math.round((serializationState.completedChapters / serializationState.totalChapters) * 100)}%
                                                    </span>
                                                </div>
                                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all"
                                                        style={{ width: `${(serializationState.completedChapters / serializationState.totalChapters) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* 启动自动连载按钮 */}
                                        {!serializationState?.isRunning && (
                                            <button
                                                onClick={handleStartSerialization}
                                                className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-medium hover:opacity-90 flex items-center justify-center gap-2"
                                            >
                                                <Play className="h-4 w-4" />
                                                ⚡ 启动自动连载
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* 返回按钮 */}
                                <button
                                    onClick={() => setStep(2)}
                                    className="w-full py-2.5 text-sm border border-border rounded-xl hover:bg-accent transition-colors flex items-center justify-center gap-1"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    返回配置
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
