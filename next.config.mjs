/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed 'output: export' to support dynamic routes like /editor/[projectId]
  // PGlite runs in the browser, so we need SSR/dynamic rendering
};

export default nextConfig;
