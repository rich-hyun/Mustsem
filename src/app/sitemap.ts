import type { MetadataRoute } from 'next'
import { SITE } from '@/config/site'

export const dynamic = 'force-static'

const PAGES: Array<{ path: string; priority: number }> = [
  { path: '/', priority: 1 },
  { path: '/developers', priority: 0.9 },
  { path: '/developers/guide', priority: 0.9 },
  { path: '/network', priority: 0.8 },
  { path: '/bridge', priority: 0.8 },
  { path: '/staking', priority: 0.8 },
  { path: '/nft', priority: 0.8 },
  { path: '/sbt', priority: 0.8 },
  { path: '/rwa', priority: 0.8 },
  { path: '/ipfs', priority: 0.8 },
  { path: '/security', priority: 0.7 },
  { path: '/dashboard', priority: 0.6 },
  { path: '/privacy', priority: 0.3 },
  { path: '/terms', priority: 0.3 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return PAGES.map(({ path, priority }) => ({
    url: `${SITE.url}${path === '/' ? '/' : path}`,
    lastModified,
    priority,
  }))
}
