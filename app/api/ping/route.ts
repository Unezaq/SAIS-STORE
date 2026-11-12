import { NextResponse } from 'next/server'

/**
 * Google ping endpoint — notifie Google du nouveau sitemap.
 * À appeler après chaque mise à jour du catalogue :
 *   curl -X POST https://monsite.com/api/ping
 */
export async function POST() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const sitemapUrl = `${base}/sitemap.xml`

  try {
    const res = await fetch(
      `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
      { method: 'GET' }
    )
    const text = await res.text()

    return NextResponse.json({
      ok: true,
      sitemap: sitemapUrl,
      google: res.status,
      body: text.slice(0, 200),
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'POST to /api/ping to notify Google of sitemap changes',
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/sitemap.xml`,
  })
}
