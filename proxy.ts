import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

function isAdminArea(pathname: string): boolean {
  return pathname.startsWith('/admin') && pathname !== '/admin/login'
}

function redirectToLogin(request: NextRequest): NextResponse {
  const url = new URL('/admin/login', request.url)
  url.searchParams.set('from', request.nextUrl.pathname)
  return NextResponse.redirect(url)
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  let session: Awaited<ReturnType<typeof updateSession>>
  try {
    session = await updateSession(request)
  } catch (error) {
    // A broken/unreachable auth check must not take the whole shop down:
    // /admin fails closed, every other page keeps serving.
    console.error('proxy: vérification de session Supabase impossible.', error)
    return isAdminArea(pathname) ? redirectToLogin(request) : NextResponse.next()
  }

  const { response, claims } = session

  if (isAdminArea(pathname)) {
    const appMetadata = claims?.app_metadata
    const role =
      typeof appMetadata === 'object' && appMetadata !== null && 'role' in appMetadata
        ? appMetadata.role
        : undefined

    if (role !== 'admin') {
      const redirectResponse = redirectToLogin(request)
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
