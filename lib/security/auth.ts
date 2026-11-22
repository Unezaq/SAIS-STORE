import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const AUTH_PROVIDERS_DISABLED_MESSAGE =
  'La connexion est désactivée dans Supabase. Ouvrez Supabase → Authentication → Sign In / Providers et activez « Email », puis réessayez.'

export function isAuthProviderDisabled(code: string | undefined): boolean {
  return code === 'email_provider_disabled' || code === 'phone_provider_disabled'
}

export async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error && error.name !== 'AuthSessionMissingError' && error.status !== 401) {
    throw error
  }

  return data.user ?? null
}

export async function requireAdmin() {
  const user = await getAuthenticatedUser()
  if (!user) redirect('/admin/login')

  // Fast-path: Check JWT app_metadata.role
  const jwtIsAdmin = (user.app_metadata?.role as string) === 'admin'
  if (jwtIsAdmin) return user

  // Fallback: Verify profiles table
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') redirect('/admin/login')
  return user
}
