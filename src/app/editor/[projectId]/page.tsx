"use client"

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import {
    Panel,
    PanelGroup,
    PanelResizeHandle
} from 'react-resizable-panels'
import LeftSidebar from '@/components/layout/LeftSidebar'
import ViralSidebar from '@/components/sidebar/ViralSidebar'
import RightSidebar from '@/components/layout/RightSidebar'
import SettingsDialog from '@/components/settings/SettingsDialog'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'
import { NovelStateProvider } from '@/lib/novel-state'
import { useNovelStore } from '@/lib/store/novel-store'
import { getProjectById } from '@/lib/actions/projects'
import { ArrowLeft, Castle, Flame } from 'lucide-react'
import Link from 'next/link'

// Dynamic import to avoid SSR issues with Tiptap
const TiptapEditor = dynamic(
    () => import('@/components/editor/TiptapEditor'),
    { ssr: false }
)

// Wrapper component to handle store initialization
function EditorLayout({ projectId }: { projectId: string }) {
    const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false)
    const { setCurrentProjectId, setCurrentEngineType, currentEngineType } = useNovelStore()

    // Load project and set engineType on mount
    useEffect(() => {
        async function loadProject() {
            if (projectId) {
                setCurrentProjectId(projectId)

                // 获取项目 engineType
                const project = await getProjectById(projectId)
                if (project && project.engineType) {
                    setCurrentEngineType(project.engineType as 'epic' | 'viral')
                    console.log(`[Editor] 加载项目引擎类型: ${project.engineType}`)
                }
            }
        }
        loadProject()
    }, [projectId, setCurrentProjectId, setCurrentEngineType])

    return (
        <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col">
            {/* Top Navigation Bar (Optional, can be integrated into sidebar or top) */}

            <PanelGroup direction="horizontal" className="h-full">
                {/* 左侧栏 - 根据引擎类型动态切换 */}
                <Panel
                    defaultSize={18}
                    minSize={12}
                    maxSize={30}
                    className="bg-card"
                >
                    <div className="flex flex-col h-full">
                        {/* Back to Dashboard Button + Engine Type Indicator */}
                        <div className="h-12 border-b border-border/30 flex items-center justify-between px-4 bg-card/50">
                            <Link href="/" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors gap-2">
                                <ArrowLeft className="h-4 w-4" />
                                <span>返回书架</span>
                            </Link>
                            {/* 引擎类型指示器 */}
                            <div className={cn(
                                "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                                currentEngineType === 'viral'
                                    ? "bg-orange-500/20 text-orange-400"
                                    : "bg-purple-500/20 text-purple-400"
                            )}>
                                {currentEngineType === 'viral' ? (
                                    <><Flame className="h-3 w-3" />爆款</>
                                ) : (
                                    <><Castle className="h-3 w-3" />宏大</>
                                )}
                            </div>
                        </div>

                        {/* 条件渲染侧边栏 */}
                        <div className="flex-1 overflow-hidden">
                            {currentEngineType === 'viral' ? (
                                <ViralSidebar />
                            ) : (
                                <LeftSidebar />
                            )}
                        </div>
                    </div>
                </Panel>

                <PanelResizeHandle className={cn(
                    "relative flex w-px items-center justify-center bg-border",
                    "after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2",
                    "hover:bg-primary/50 transition-colors"
                )}>
                    <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-2.5 w-2.5"
                        >
                            <circle cx="12" cy="5" r="1" />
                            <circle cx="12" cy="12" r="1" />
                            <circle cx="12" cy="19" r="1" />
                        </svg>
                    </div>
                </PanelResizeHandle>

                {/* 中间栏 - 沉浸式编辑器 */}
                <Panel defaultSize={isRightSidebarCollapsed ? 80 : 58} minSize={40}>
                    <div className="h-full bg-editor flex flex-col dark">
                        {/* 编辑器工具栏区域 */}
                        <div className="h-12 border-b border-border/30 flex items-center justify-between px-4 bg-card/30 text-foreground">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">第一章：命运的相遇.md</span>
                                <span className="text-xs text-muted-foreground/60">|</span>
                                <span className="text-xs text-muted-foreground/60">自动保存已启用</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <ThemeToggle />
                                <SettingsDialog />
                            </div>
                        </div>
                        {/* Tiptap 编辑器 */}
                        <div className="flex-1 overflow-hidden">
                            <TiptapEditor />
                        </div>
                    </div>
                </Panel>

                <PanelResizeHandle className={cn(
                    "relative flex w-px items-center justify-center bg-border",
                    "after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2",
                    "hover:bg-primary/50 transition-colors"
                )}>
                    <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-2.5 w-2.5"
                        >
                            <circle cx="12" cy="5" r="1" />
                            <circle cx="12" cy="12" r="1" />
                            <circle cx="12" cy="19" r="1" />
                        </svg>
                    </div>
                </PanelResizeHandle>

                {/* 右侧栏 - Codex 状态 & AI 逻辑检查 */}
                <Panel
                    defaultSize={isRightSidebarCollapsed ? 2 : 24}
                    minSize={isRightSidebarCollapsed ? 2 : 15}
                    maxSize={35}
                    className="bg-card"
                >
                    <RightSidebar
                        isCollapsed={isRightSidebarCollapsed}
                        onToggle={() => setIsRightSidebarCollapsed(!isRightSidebarCollapsed)}
                    />
                </Panel>
            </PanelGroup>
        </div>
    )
}

export default function Page({ params }: { params: { projectId: string } }) {
    return (
        <NovelStateProvider>
            <EditorLayout projectId={params.projectId} />
        </NovelStateProvider>
    )
}
