import type { MetadataRoute } from 'next'
import { SITE } from '@/config/site'

export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/confirm'] },
    sitemap: `${SITE.url}/sitemap.xml`,
  }
}
