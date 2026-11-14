import { NextResponse } from 'next/server'
import { clientEnv } from '@/lib/env'

const sitemapUrl = `${clientEnv.NEXT_PUBLIC_SITE_URL}/sitemap.xml`
const retiredMessage =
  'Google has retired the sitemap ping endpoint. Submit the sitemap through Search Console or list it in robots.txt.'

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: retiredMessage,
    sitemap: sitemapUrl,
  })
}

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: retiredMessage,
      sitemap: sitemapUrl,
    },
    { status: 410 }
  )
}
