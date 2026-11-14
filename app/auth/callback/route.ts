import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { ensureClientProfile } from '@/lib/store'
import { bootstrapConfiguredAdmin } from '@/lib/supabase/bootstrap-admin'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const requestedNext = request.nextUrl.searchParams.get('next') ?? '/'
  const next = requestedNext.startsWith('/') &&
    !requestedNext.startsWith('//') &&
    !requestedNext.includes('\\')
    ? requestedNext
    : '/'

  if (!code) {
    return NextResponse.redirect(new URL('/login?authError=callback', request.url))
  }

  const supabase = await createClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    return NextResponse.redirect(new URL('/login?authError=callback', request.url))
  }

  const { data, error: userError } = await supabase.auth.getUser()
  if (userError || !data.user?.email || !data.user.email_confirmed_at) {
    return NextResponse.redirect(new URL('/login?authError=verification', request.url))
  }

  const profile = z.object({
    first_name: z.string().trim().min(1).max(80),
    last_name: z.string().trim().min(1).max(80),
    phone: z.string().trim().regex(/^\+?[\d\s()-]{9,18}$/),
    address: z.string().trim().max(500),
  }).safeParse(data.user.user_metadata)

  if (!profile.success) {
    return NextResponse.redirect(new URL('/account?profileError=invalid', request.url))
  }

  await ensureClientProfile({
    authUserId: data.user.id,
    email: data.user.email,
    firstName: profile.data.first_name,
    lastName: profile.data.last_name,
    phone: profile.data.phone,
    address: profile.data.address,
  })

  const isBootstrapAdmin = await bootstrapConfiguredAdmin(data.user.id)
  if (isBootstrapAdmin) {
    const { error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) throw refreshError
  }

  return NextResponse.redirect(new URL(isBootstrapAdmin ? '/admin' : next, request.url))
}
