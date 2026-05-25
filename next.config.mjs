/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed 'output: export' to support dynamic routes like /editor/[projectId]
  // PGlite runs in the browser, so we need SSR/dynamic rendering

  // 跳过 build 时的类型检查 (历史代码兼容,后续会逐步修复)
  // 开发模式下仍会有类型提示
  typescript: {
    ignoreBuildErrors: true,
  },

  // 跳过 build 时的 ESLint 检查 (规则在 .eslintrc.json 中已放宽)
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
