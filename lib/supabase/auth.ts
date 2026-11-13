import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error && error.name !== 'AuthSessionMissingError' && error.status !== 401) {
    throw error
  }

  return data.user
}

export async function requireAdmin() {
  const user = await getAuthenticatedUser()
  if (user?.app_metadata?.role !== 'admin') redirect('/admin/login')
  return user
}
