'use client'

import { AlertTriangleIcon, RefreshCwIcon } from 'lucide-react'

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <html lang="zh-CN">
            <body className="bg-background text-foreground">
                <div className="flex h-screen w-full flex-col items-center justify-center p-4">
                    <div className="flex flex-col items-center max-w-md text-center space-y-4">
                        <div className="p-4 rounded-full bg-destructive/10 text-destructive">
                            <AlertTriangleIcon className="h-8 w-8" />
                        </div>
                        <h2 className="text-xl font-bold">发生严重错误</h2>
                        <p className="text-muted-foreground text-sm">
                            无法加载根布局。这通常是配置或样式表严重损坏导致的。
                        </p>
                        <div className="p-2 text-xs font-mono bg-muted/50 rounded border border-border w-full overflow-auto max-h-32 text-left">
                            {error.message || '未知错误'}
                        </div>
                        <button
                            onClick={() => reset()}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            <RefreshCwIcon className="h-4 w-4" />
                            重试加载
                        </button>
                    </div>
                </div>
            </body>
        </html>
    )
}
