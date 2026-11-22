import type { MetadataRoute } from 'next'
import { clientEnv } from '@/lib/env'

/**
 * Native Next.js metadata route — served at /robots.txt.
 * Everything is crawlable; the PWA offline page and service worker are excluded.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/admin', '/api/', '/~offline', '/sw.js'],
    },
    sitemap: `${clientEnv.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
  }
}
