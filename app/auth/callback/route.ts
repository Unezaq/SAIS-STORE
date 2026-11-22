import { NextResponse, type NextRequest } from 'next/server'
import { bootstrapConfiguredAdmin } from '@/lib/supabase/bootstrap-admin'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const requestedNext = request.nextUrl.searchParams.get('next') ?? '/'
  const next =
    requestedNext.startsWith('/') &&
    !requestedNext.startsWith('//') &&
    !requestedNext.includes('\\')
      ? requestedNext
      : '/'

  if (!code) {
    return NextResponse.redirect(new URL('/admin/login?authError=callback', request.url))
  }

  const supabase = await createClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    return NextResponse.redirect(new URL('/admin/login?authError=callback', request.url))
  }

  const { data, error: userError } = await supabase.auth.getUser()
  if (userError || !data.user) {
    return NextResponse.redirect(new URL('/admin/login?authError=verification', request.url))
  }

  // Check and bootstrap admin if configured
  const isBootstrapAdmin = await bootstrapConfiguredAdmin(data.user.id).catch(() => false)
  if (isBootstrapAdmin) {
    const { error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) {
      console.error('Session refresh error after admin bootstrap:', refreshError)
    }
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  // Check if existing admin
  const isAdmin = data.user.app_metadata?.role === 'admin'
  if (isAdmin) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  return NextResponse.redirect(new URL(next, request.url))
}
