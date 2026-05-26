/**
 * HTTP 代理 - 给浏览器开发环境绕过 CORS
 *
 * Tauri 桌面应用走原生 http_proxy 命令,这个 route 只在浏览器 dev 模式生效
 */

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ProxyRequest {
    url: string
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    headers?: Record<string, string>
    body?: string | null
}

export async function POST(req: NextRequest) {
    let parsedUrl = ''
    try {
        const data = (await req.json()) as ProxyRequest

        if (!data.url) {
            return NextResponse.json(
                { status: 400, body: 'Missing url', ok: false, error: '请求缺少 URL' },
                { status: 200 }  // 改为 200,让前端能解析 body
            )
        }

        let url = data.url.trim()

        // 自动补 https:// (兼容用户输入 api.example.com)
        if (!/^https?:\/\//.test(url)) {
            url = 'https://' + url
        }

        // 自动修正双斜杠 (除了 :// 之后的)
        url = url.replace(/([^:])\/\//g, '$1/')

        parsedUrl = url

        // URL 合法性检查
        try {
            new URL(url)
        } catch {
            return NextResponse.json(
                { status: 400, body: `URL 格式错误: ${url}`, ok: false, error: 'Invalid URL' },
                { status: 200 }
            )
        }

        console.log(`[proxy] ${data.method || 'GET'} ${url}`)

        // 转发请求
        const upstream = await fetch(url, {
            method: data.method || 'GET',
            headers: data.headers || {},
            body: data.body || undefined,
            signal: AbortSignal.timeout(20000)  // 20 秒
        })

        const text = await upstream.text()

        console.log(`[proxy] ← ${upstream.status} (${text.length} bytes)`)

        return NextResponse.json({
            status: upstream.status,
            body: text,
            ok: upstream.ok
        })
    } catch (e) {
        const msg = e instanceof Error ? e.message : '未知错误'
        console.error(`[proxy] 错误 ${parsedUrl}:`, msg)
        return NextResponse.json(
            { status: 500, body: `代理请求失败: ${msg}`, ok: false, error: msg },
            { status: 200 }
        )
    }
}
