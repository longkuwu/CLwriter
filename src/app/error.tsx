'use client'

import { useEffect } from 'react'
import { AlertTriangleIcon, RefreshCwIcon } from 'lucide-react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error)
    }, [error])

    return (
        <div className="flex h-screen w-full flex-col items-center justify-center p-4 bg-background text-foreground">
            <div className="flex flex-col items-center max-w-md text-center space-y-4">
                <div className="p-4 rounded-full bg-destructive/10 text-destructive">
                    <AlertTriangleIcon className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-bold">出了一点问题</h2>
                <p className="text-muted-foreground text-sm">
                    应用遇到了一些意料之外的错误。请尝试刷新页面。
                </p>
                <div className="p-2 text-xs font-mono bg-muted/50 rounded border border-border w-full overflow-auto max-h-32 text-left">
                    {error.message || '未知错误'}
                </div>
                <button
                    onClick={() => reset()}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                    <RefreshCwIcon className="h-4 w-4" />
                    重试
                </button>
            </div>
        </div>
    )
}
