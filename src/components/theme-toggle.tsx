"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { SunIcon, MoonIcon, MonitorIcon, PaletteIcon, CheckIcon } from "lucide-react"

const themes = [
    { id: 'light', name: '浅色', icon: SunIcon },
    { id: 'dark', name: '深色', icon: MoonIcon },
    { id: 'system', name: '跟随系统', icon: MonitorIcon },
]

export function ThemeToggle() {
    const [mounted, setMounted] = React.useState(false)
    const [isOpen, setIsOpen] = React.useState(false)
    const { theme, setTheme } = useTheme()

    // 避免 hydration 不匹配
    React.useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return (
            <button className="p-2 rounded-lg hover:bg-accent transition-colors">
                <PaletteIcon className="h-5 w-5 text-muted-foreground" />
            </button>
        )
    }

    const currentTheme = themes.find(t => t.id === theme) || themes[2]
    const CurrentIcon = currentTheme.icon

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
                title="切换主题"
            >
                <CurrentIcon className="h-5 w-5 text-muted-foreground" />
            </button>

            {isOpen && (
                <>
                    {/* 点击外部关闭 */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* 下拉菜单 */}
                    <div className="absolute right-0 top-full mt-2 z-50 py-1 w-36 rounded-lg border border-border bg-popover shadow-lg">
                        {themes.map((t) => {
                            const Icon = t.icon
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => {
                                        setTheme(t.id)
                                        setIsOpen(false)
                                    }}
                                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <Icon className="h-4 w-4" />
                                        <span>{t.name}</span>
                                    </div>
                                    {theme === t.id && (
                                        <CheckIcon className="h-4 w-4 text-primary" />
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </>
            )}
        </div>
    )
}
