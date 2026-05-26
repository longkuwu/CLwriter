/**
 * 端点发现 - 借鉴天命 EndpointTestService 的设计
 *
 * 核心算法 (引用自 zy-zmc/tianming-novel-ai-writer EndpointTestService.cs):
 *
 *   1. 路径剥离: 用户输入 https://x.com/v1/chat/completions
 *      → 剥成 https://x.com/v1
 *
 *   2. 版本识别: 用正则识别 /v1, /v2, /v1beta 等
 *      VersionPrefixRegex = /\/v\d+(?:beta\d*|alpha\d*)?$/i
 *
 *   3. 候选生成 (按场景):
 *      - 已带版本: [原值, 无版本根, 无版本根/v1, 无版本根/compatible-mode/v1]
 *      - 未带版本: [原值, /v1, /compatible-mode/v1, /openai/v1, /api/v1, /openai]
 *
 *   4. 并行扫描所有候选,取 model 数量最多的成功端点
 *
 *   5. HTML 检测: 跳过返回 HTML 的端点 (那是前端页面,不是 API)
 */

// 已知的 API 路径后缀 (用户可能粘贴完整 endpoint URL)
const KNOWN_API_PATH_SUFFIXES = [
    '/chat/completions',
    '/responses',
    '/messages',
    '/completions',
    '/models',
    '/embeddings',
    '/images/generations',
    '/audio/transcriptions',
    '/audio/translations',
    '/audio/speech',
    '/moderations',
    '/generateContent',
] as const

// 版本号识别 (尾部)
const VERSION_PREFIX_REGEX = /\/v\d+(?:beta\d*|alpha\d*)?$/i

/**
 * 把用户输入规范化为 baseURL,并生成候选 baseURL 列表
 *
 * 算法翻译自天命 EndpointTestService.GenerateCandidateUrls
 */
export function generateCandidateBaseUrls(rawInput: string): string[] {
    if (!rawInput || !rawInput.trim()) return []

    // 自动补 https://
    let trimmed = rawInput.trim()
    if (!/^https?:\/\//.test(trimmed)) {
        trimmed = 'https://' + trimmed
    }

    // 去除尾部斜杠
    trimmed = trimmed.replace(/\/+$/, '')

    // 剥离已知 API 路径后缀 (如用户粘贴了完整 endpoint)
    for (const suffix of KNOWN_API_PATH_SUFFIXES) {
        if (trimmed.toLowerCase().endsWith(suffix)) {
            trimmed = trimmed.slice(0, -suffix.length).replace(/\/+$/, '')
            break
        }
    }

    // 剥离 :model:generateContent 这种 (Gemini)
    trimmed = trimmed.replace(/\/models\/[^/]+:generateContent$/i, '').replace(/\/+$/, '')

    const candidates: string[] = []
    const versionMatch = trimmed.match(VERSION_PREFIX_REGEX)

    if (versionMatch) {
        // 已带版本
        const withVersion = trimmed
        const withoutVersion = trimmed.slice(0, -versionMatch[0].length).replace(/\/+$/, '')

        candidates.push(withVersion)
        if (withoutVersion) candidates.push(withoutVersion)

        // 如果不是 /v1, 也尝试 /v1
        if (versionMatch[0].toLowerCase() !== '/v1') {
            if (withoutVersion) candidates.push(withoutVersion + '/v1')
        }

        // 阿里通义千问的 compatible-mode
        if (withoutVersion) candidates.push(withoutVersion + '/compatible-mode/v1')

        // 如果路径以 /api 结尾,尝试剥掉 /api
        if (withoutVersion.toLowerCase().endsWith('/api')) {
            const withoutApi = withoutVersion.slice(0, -4).replace(/\/+$/, '')
            if (withoutApi) candidates.push(withoutApi + versionMatch[0])
        }
    } else {
        // 未带版本号
        candidates.push(trimmed)
        candidates.push(trimmed + '/v1')
        candidates.push(trimmed + '/compatible-mode/v1')   // 阿里通义千问
        candidates.push(trimmed + '/openai/v1')             // 部分中转
        candidates.push(trimmed + '/api/v1')                // 部分中转
        candidates.push(trimmed + '/v1beta')                // Gemini
        candidates.push(trimmed + '/openai')                // 部分中转 (无 /v1 后缀)

        // ⭐ 重要兜底: 如果路径里有自定义子目录 (如 /codex, /myapi),
        // 中转可能把 /v1 挂在根域名上,自定义路径只暴露特殊端点
        // 所以也尝试根域名 (剥掉所有路径)
        try {
            const u = new URL(trimmed)
            if (u.pathname && u.pathname !== '/') {
                const root = `${u.protocol}//${u.host}`
                candidates.push(root + '/v1')
                candidates.push(root)

                // 也尝试逐层剥掉路径段 (深路径降级到浅路径)
                const segs = u.pathname.split('/').filter(Boolean)
                for (let i = segs.length - 1; i >= 1; i--) {
                    const partial = `${root}/${segs.slice(0, i).join('/')}`
                    candidates.push(partial + '/v1')
                }
            }
        } catch {
            // URL 解析失败,忽略
        }
    }

    // 去重 (大小写不敏感)
    const seen = new Set<string>()
    const result: string[] = []
    for (const c of candidates) {
        const lower = c.toLowerCase()
        if (!seen.has(lower)) {
            seen.add(lower)
            result.push(c)
        }
    }
    return result
}

/**
 * 检查响应内容是否是 HTML (用来跳过前端页面)
 */
export function isHtmlResponse(content: string): boolean {
    if (!content) return false
    const trimmed = content.trimStart()
    return (
        trimmed.startsWith('<') ||
        trimmed.toLowerCase().startsWith('<!doctype') ||
        trimmed.toLowerCase().includes('<html') ||
        trimmed.toLowerCase().includes('<head')
    )
}

/**
 * 模拟 Cherry Studio 的 User-Agent (避免 WAF 拦截)
 *
 * 灵感: 天命用了 Chrome User-Agent + Cherry Studio Origin
 */
export const STANDARD_BROWSER_HEADERS: Record<string, string> = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/132.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
    'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'cross-site',
}

/**
 * HTTP 错误分类 (中文友好提示)
 */
export function classifyHttpError(status: number, body?: string): {
    code: string
    message: string
} {
    const sample = (body || '').slice(0, 200)

    // 试着解析 JSON 错误信息
    let detail = ''
    try {
        const j = JSON.parse(sample)
        detail = j?.error?.message || j?.message || j?.error || j?.detail || j?.msg || ''
    } catch {
        detail = sample
    }

    const map: Record<number, { code: string; category: string }> = {
        400: { code: 'BAD_REQUEST', category: '请求格式错误' },
        401: { code: 'AUTH_FAILED', category: '密钥鉴权失败' },
        402: { code: 'PAYMENT_REQUIRED', category: '配额不足/账户欠费' },
        403: { code: 'FORBIDDEN', category: '访问被拒绝' },
        404: { code: 'NOT_FOUND', category: '模型或端点不存在' },
        408: { code: 'TIMEOUT', category: '请求超时' },
        413: { code: 'PAYLOAD_TOO_LARGE', category: '请求体过大' },
        422: { code: 'UNPROCESSABLE', category: '请求参数不合法' },
        429: { code: 'RATE_LIMIT', category: '触发限流' },
    }

    const info = map[status] || (status >= 500
        ? { code: 'SERVER_ERROR', category: '服务端错误' }
        : { code: 'UNKNOWN', category: '端点响应异常' })

    return {
        code: info.code,
        message: detail
            ? `${info.category}（HTTP ${status}）: ${detail.slice(0, 120)}`
            : `${info.category}（HTTP ${status}）`
    }
}

/**
 * 网络错误分类
 */
export function classifyNetworkError(error: Error | string): string {
    const msg = (error instanceof Error ? error.message : String(error)).toLowerCase()

    if (msg.includes('timeout') || msg.includes('aborted')) return '请求超时'
    if (msg.includes('enotfound') || msg.includes('getaddrinfo')) return '域名解析失败'
    if (msg.includes('econnrefused')) return '连接被拒绝'
    if (msg.includes('econnreset')) return '连接被重置'
    if (msg.includes('ssl') || msg.includes('certificate')) return 'SSL/证书错误'
    if (msg.includes('cors')) return 'CORS 阻止'

    return error instanceof Error ? error.message : String(error)
}
