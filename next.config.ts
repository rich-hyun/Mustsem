import path from 'node:path'
import type { NextConfig } from 'next'

/** 모든 응답에 붙는 보안 헤더 (기존 vercel.json과 같은 값) */
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
]

/** 기존 정적 사이트의 .html 주소 → 새 주소 (api·api-guide는 이름이 바뀌어 따로 둔다) */
const LEGACY_PAGES = 'network|bridge|staking|nft|sbt|rwa|ipfs|security|dashboard|login|signup|confirm|privacy|terms'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  // 상위 폴더의 다른 lockfile을 작업 루트로 오인하지 않게 고정한다
  turbopack: { root: path.join(__dirname) },
  experimental: { optimizePackageImports: ['@phosphor-icons/react'] },

  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/api.html', destination: '/developers', permanent: true },
      // 정확히 /api 만: /api/market-data 같은 하위 경로는 그대로 둔다
      { source: '/api', destination: '/developers', permanent: true },
      { source: '/api-guide.html', destination: '/developers/guide', permanent: true },
      { source: '/api-guide', destination: '/developers/guide', permanent: true },
      { source: `/:page(${LEGACY_PAGES}).html`, destination: '/:page', permanent: true },
    ]
  },

  async rewrites() {
    return [
      { source: '/fx', destination: 'http://203.252.147.200:20210/' },
      { source: '/fx/:path*', destination: 'http://203.252.147.200:20210/:path*' },
    ]
  },

  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      {
        source: '/media/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
    ]
  },
}

export default nextConfig
