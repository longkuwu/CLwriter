import Link from 'next/link'
import { FileQuestionIcon, HomeIcon } from 'lucide-react'

export default function NotFound() {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center p-4 bg-background text-foreground">
            <div className="flex flex-col items-center max-w-md text-center space-y-4">
                <div className="p-4 rounded-full bg-muted text-muted-foreground">
                    <FileQuestionIcon className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-bold">页面未找到 (404)</h2>
                <p className="text-muted-foreground text-sm">
                    您请求的页面或资源似乎不存在。
                </p>
                <Link
                    href="/"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                    <HomeIcon className="h-4 w-4" />
                    返回首页
                </Link>
            </div>
        </div>
    )
}
