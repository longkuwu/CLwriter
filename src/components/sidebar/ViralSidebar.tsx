"use client"

import { useState } from 'react'
import { Dna, Sparkles, FolderOpen, Flame, Plus } from 'lucide-react'
import DeconstructPanel from '@/components/sidebar/DeconstructPanel'
import { cn } from '@/lib/utils'

type ViralTab = 'deconstruct' | 'imitate' | 'chapters'

/**
 * ViralSidebar v5.2 - 流量爆款模式专用侧边栏
 * 
 * 三段式工作流：
 * - 🧬 拆解：上传/粘贴文本 → 自适应分析 → 生成骨架
 * - 📝 仿写：输入主题 → 结合骨架 → 生成正文
 * - 📂 目录：轻量级章节管理（支持拖拽）
 */
export default function ViralSidebar() {
    const [activeTab, setActiveTab] = useState<ViralTab>('deconstruct')

    const tabs = [
        { id: 'deconstruct' as ViralTab, icon: Dna, label: '🧬 拆解', color: 'text-orange-500' },
        { id: 'imitate' as ViralTab, icon: Sparkles, label: '📝 仿写', color: 'text-pink-500' },
        { id: 'chapters' as ViralTab, icon: FolderOpen, label: '📂 目录', color: 'text-blue-500' },
    ]

    return (
        <div className="h-full flex flex-col bg-card/50">
            {/* 顶部标识 */}
            <div className="px-4 py-3 border-b border-border/50 bg-gradient-to-r from-orange-500/10 to-red-500/10">
                <div className="flex items-center gap-2">
                    <Flame className="h-5 w-5 text-orange-400" />
                    <span className="font-bold text-foreground">流量爆款模式</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    拆解结构 → 骨架重绘 → 批量生成
                </p>
            </div>

            {/* Tab 导航 */}
            <div className="flex border-b border-border">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                            activeTab === tab.id
                                ? `${tab.color} bg-accent/50 border-b-2 border-current`
                                : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
                        )}
                    >
                        <tab.icon className="h-4 w-4" />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab 内容 */}
            <div className="flex-1 overflow-auto">
                {activeTab === 'deconstruct' && <DeconstructPanel />}
                {activeTab === 'imitate' && <ImitateTab />}
                {activeTab === 'chapters' && <ChaptersTab />}
            </div>
        </div>
    )
}

/**
 * 📝 仿写标签页 - 配置主题和生成
 */
function ImitateTab() {
    return (
        <div className="p-4 space-y-4">
            <div className="text-center py-8">
                <Sparkles className="h-12 w-12 mx-auto text-pink-400/50 mb-4" />
                <h3 className="font-medium text-foreground mb-2">仿写生成</h3>
                <p className="text-xs text-muted-foreground mb-4">
                    输入新主题，结合骨架生成正文
                </p>
                <p className="text-xs text-muted-foreground">
                    💡 请先在&quot;拆解&quot;标签页中完成分析
                    <br />
                    仿写配置已集成在拆解流程中
                </p>
            </div>
        </div>
    )
}

/**
 * 📂 目录标签页 - 章节管理
 */
function ChaptersTab() {
    return (
        <div className="p-4 space-y-4">
            <div className="text-center py-8">
                <FolderOpen className="h-12 w-12 mx-auto text-blue-400/50 mb-4" />
                <h3 className="font-medium text-foreground mb-2">章节目录</h3>
                <p className="text-xs text-muted-foreground mb-4">
                    长文仿写时会自动创建章节
                </p>
                <p className="text-xs text-muted-foreground">
                    💡 批量创建的章节将显示在这里
                    <br />
                    支持拖拽排序和快速跳转
                </p>
            </div>

            {/* 手动添加按钮 */}
            <button className="w-full py-2.5 text-sm border border-dashed border-border rounded-xl hover:bg-accent/30 transition-colors flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground">
                <Plus className="h-4 w-4" />
                添加新章节
            </button>
        </div>
    )
}
