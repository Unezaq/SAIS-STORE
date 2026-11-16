import 'server-only'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { CUSTOMER_SESSION_COOKIE } from '@/lib/auth/session'

export type CustomerSession = {
  id: string
  full_name: string
  email: string
  normalized_email: string
  phone: string
  normalized_phone: string
  city: string
  address: string
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Read the customer session from cookies and validate it.
 * Safe to call from Server Components (reads cookies directly).
 * Returns null if no valid session exists.
 */
export async function getCustomerFromSession(): Promise<CustomerSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value
  if (!token) return null

  const supabase = createAdminClient()
  const { createHash } = await import('node:crypto')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const now = new Date().toISOString()

  const { data: session } = await supabase
    .from('customer_sessions')
    .select('*')
    .eq('session_token_hash', tokenHash)
    .is('revoked_at', null)
    .gt('expires_at', now)
    .maybeSingle()

  if (!session) return null

  // Update last activity (non-blocking, fire and forget would be ideal but await is fine)
  await supabase
    .from('customer_sessions')
    .update({ last_activity_at: now })
    .eq('id', (session as { id: string }).id)

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', (session as { customer_id: string }).customer_id)
    .eq('is_active', true)
    .maybeSingle()

  if (!customer) return null

  return customer as CustomerSession
}
