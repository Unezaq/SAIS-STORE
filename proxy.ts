import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { response, claims } = await updateSession(request)

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const appMetadata = claims?.app_metadata
    const role =
      typeof appMetadata === 'object' && appMetadata !== null && 'role' in appMetadata
        ? appMetadata.role
        : undefined

    if (role !== 'admin') {
      const url = new URL('/admin/login', request.url)
      url.searchParams.set('from', pathname)
      const redirectResponse = NextResponse.redirect(url)
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie)
      })
      for (const header of ['cache-control', 'expires', 'pragma']) {
        const value = response.headers.get(header)
        if (value) redirectResponse.headers.set(header, value)
      }
      return redirectResponse
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
