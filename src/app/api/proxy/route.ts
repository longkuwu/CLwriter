/**
 * HTTP 代理 - 给浏览器开发环境绕过 CORS
 *
 * Tauri 桌面应用走原生 http_proxy 命令,这个 route 只在浏览器 dev 模式生效
 *
 * 使用方式:
 *   POST /api/proxy
 *   Body: { url: string, method: 'GET'|'POST', headers?: Record<string,string>, body?: string }
 *   Response: { status: number, body: string, ok: boolean }
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
    try {
        const data = (await req.json()) as ProxyRequest

        if (!data.url) {
            return NextResponse.json(
                { status: 400, body: 'Missing url', ok: false },
                { status: 400 }
            )
        }

        // 简单的 URL 白名单校验 (可根据需要调整)
        if (!/^https?:\/\//.test(data.url)) {
            return NextResponse.json(
                { status: 400, body: 'Invalid URL scheme', ok: false },
                { status: 400 }
            )
        }

        // 转发请求
        const upstream = await fetch(data.url, {
            method: data.method || 'GET',
            headers: data.headers || {},
            body: data.body || undefined,
            // 8 秒超时
            signal: AbortSignal.timeout(15000)
        })

        const text = await upstream.text()

        return NextResponse.json({
            status: upstream.status,
            body: text,
            ok: upstream.ok
        })
    } catch (e) {
        const msg = e instanceof Error ? e.message : '未知错误'
        return NextResponse.json(
            { status: 500, body: `代理请求失败: ${msg}`, ok: false },
            { status: 200 }  // 200 让前端能正常解析
        )
    }
}
