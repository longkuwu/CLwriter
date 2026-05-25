"use client"

import { useState } from 'react'
import { Camera, Shield, BookMarked, Sparkles } from 'lucide-react'
import FactSnapshotPanel from './FactSnapshotPanel'
import GateLogPanel from './GateLogPanel'
import EntityManagerPanel from './EntityManagerPanel'
import ChapterGenerateDialog from './ChapterGenerateDialog'
import { cn } from '@/lib/utils'

type Tab = 'snapshot' | 'gates' | 'entities'

const TABS: Array<{ id: Tab; label: string; icon: typeof Camera }> = [
    { id: 'snapshot', label: '事实快照', icon: Camera },
    { id: 'entities', label: '实体档案', icon: BookMarked },
    { id: 'gates', label: '门禁日志', icon: Shield },
]

/**
 * 引擎控制面板 - 状态驱动写作的核心 UI
 */
export default function EnginePanel() {
    const [activeTab, setActiveTab] = useState<Tab>('snapshot')
    const [generateOpen, setGenerateOpen] = useState(false)

    return (
        <div className="h-full flex flex-col">
            {/* 引擎主入口 */}
            <button
                onClick={() => setGenerateOpen(true)}
                className="m-2 px-3 py-2 rounded bg-gradient-to-r from-primary to-purple-500 text-primary-foreground text-xs font-medium hover:opacity-90 flex items-center justify-center gap-1.5 shadow-md"
            >
                <Sparkles className="h-3.5 w-3.5" />
                状态驱动 - 生成下一章
            </button>

            {/* Tab 切换 */}
            <div className="flex border-b border-border/30">
                {TABS.map((tab) => {
                    const Icon = tab.icon
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-1 py-2 text-xs transition-colors border-b-2',
                                activeTab === tab.id
                                    ? 'border-primary text-foreground bg-accent/30'
                                    : 'border-transparent text-muted-foreground hover:bg-accent/20'
                            )}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            <span>{tab.label}</span>
                        </button>
                    )
                })}
            </div>

            {/* Tab 内容 */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'snapshot' && <FactSnapshotPanel />}
                {activeTab === 'gates' && <GateLogPanel />}
                {activeTab === 'entities' && <EntityManagerPanel />}
            </div>

            {/* 生成对话框 */}
            <ChapterGenerateDialog
                open={generateOpen}
                onClose={() => setGenerateOpen(false)}
            />
        </div>
    )
}
