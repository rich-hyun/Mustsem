import type { MetadataRoute } from 'next'
import { SITE } from '@/config/site'

export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/confirm', '/agent', '/account', '/admin', '/forgot-password'] },
    sitemap: `${SITE.url}/sitemap.xml`,
  }
}
