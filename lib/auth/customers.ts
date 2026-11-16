import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export type CustomerRow = {
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

export type CredentialRow = {
  id: string
  customer_id: string
  password_hash: string
  password_updated_at: string
  created_at: string
}

export type SessionRow = {
  id: string
  customer_id: string
  session_token_hash: string
  expires_at: string
  created_at: string
  last_activity_at: string
  revoked_at: string | null
}

/**
 * Find a customer by email or phone (normalized).
 * Returns the customer and their credential.
 */
export async function findCustomerByIdentifier(
  identifier: string
): Promise<{
  customer: CustomerRow | null
  credential: CredentialRow | null
}> {
  const supabase = createAdminClient()
  const isEmail = identifier.includes('@')
  const normalized = isEmail ? identifier.toLowerCase() : identifier

  const column = isEmail ? 'normalized_email' : 'normalized_phone'

  const { data: customer, error } = await supabase
    .from('customers')
    .select('*')
    .eq(column, normalized)
    .maybeSingle()

  if (error || !customer) {
    return { customer: null, credential: null }
  }

  const { data: credential } = await supabase
    .from('customer_credentials')
    .select('*')
    .eq('customer_id', customer.id)
    .maybeSingle()

  return { customer: customer as CustomerRow, credential: credential as CredentialRow | null }
}

/**
 * Create a new customer, their credential, and return the customer row.
 */
export async function createCustomerRecord({
  fullName,
  email,
  normalizedEmail,
  phone,
  normalizedPhone,
  city,
  address,
  passwordHash,
}: {
  fullName: string
  email: string | null
  normalizedEmail: string | null
  phone: string
  normalizedPhone: string
  city: string
  address: string
  passwordHash: string
}): Promise<{ customer: CustomerRow; credential: CredentialRow }> {
  const supabase = createAdminClient()

  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      full_name: fullName,
      email: email ?? '',
      normalized_email: normalizedEmail ?? '',
      phone,
      normalized_phone: normalizedPhone,
      city,
      address,
      is_active: true,
    })
    .select('*')
    .single()

  if (error || !customer) {
    throw new Error('Failed to create customer record.')
  }

  const customerRow = customer as CustomerRow

  const { data: credential, error: credError } = await supabase
    .from('customer_credentials')
    .insert({
      customer_id: customerRow.id,
      password_hash: passwordHash,
    })
    .select('*')
    .single()

  if (credError || !credential) {
    // Roll back the customer row if credential creation fails.
    await supabase.from('customers').delete().eq('id', customerRow.id)
    throw new Error('Failed to create customer credentials.')
  }

  return { customer: customerRow, credential: credential as CredentialRow }
}

/**
 * Update a customer's password hash.
 */
export async function updateCustomerPassword(
  customerId: string,
  passwordHash: string
): Promise<void> {
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('customer_credentials')
    .select('id')
    .eq('customer_id', customerId)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('customer_credentials')
      .update({ password_hash: passwordHash, password_updated_at: new Date().toISOString() })
      .eq('customer_id', customerId)
  } else {
    await supabase.from('customer_credentials').insert({
      customer_id: customerId,
      password_hash: passwordHash,
    })
  }
}

/**
 * Create a customer session and return the session token and row.
 * All existing non-revoked sessions for this customer are revoked
 * (session rotation / single-session enforcement).
 */
export async function createCustomerSession(customerId: string): Promise<{
  sessionToken: string
  session: SessionRow
}> {
  const supabase = createAdminClient()
  const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
  const tokenHash = createHashSha256(token)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

  // Revoke all existing sessions for this customer (rotation).
  await supabase
    .from('customer_sessions')
    .update({ revoked_at: now.toISOString() })
    .eq('customer_id', customerId)
    .is('revoked_at', null)

  const { data: session, error } = await supabase
    .from('customer_sessions')
    .insert({
      customer_id: customerId,
      session_token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      created_at: now.toISOString(),
      last_activity_at: now.toISOString(),
      revoked_at: null,
    })
    .select('*')
    .single()

  if (error || !session) {
    throw new Error('Failed to create customer session.')
  }

  return { sessionToken: token, session: session as SessionRow }
}

/**
 * Validate a session token. Returns the customer row if valid,
 * null otherwise. Updates last_activity_at on success.
 */
export async function validateSessionToken(
  token: string
): Promise<CustomerRow | null> {
  const supabase = createAdminClient()
  const tokenHash = createHashSha256(token)
  const now = new Date().toISOString()

  const { data: session } = await supabase
    .from('customer_sessions')
    .select('*')
    .eq('session_token_hash', tokenHash)
    .is('revoked_at', null)
    .gt('expires_at', now)
    .maybeSingle()

  if (!session) {
    return null
  }

  const sessionRow = session as SessionRow

  // Update last activity.
  await supabase
    .from('customer_sessions')
    .update({ last_activity_at: now })
    .eq('id', sessionRow.id)

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', sessionRow.customer_id)
    .eq('is_active', true)
    .maybeSingle()

  if (!customer) {
    return null
  }

  return customer as CustomerRow
}

/**
 * Revoke a session (logout).
 */
export async function revokeSession(token: string): Promise<void> {
  const supabase = createAdminClient()
  const tokenHash = createHashSha256(token)
  const now = new Date().toISOString()

  await supabase
    .from('customer_sessions')
    .update({ revoked_at: now })
    .eq('session_token_hash', tokenHash)
    .is('revoked_at', null)
}

/**
 * Revoke all sessions for a customer.
 */
export async function revokeAllCustomerSessions(customerId: string): Promise<void> {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  await supabase
    .from('customer_sessions')
    .update({ revoked_at: now })
    .eq('customer_id', customerId)
    .is('revoked_at', null)
}

/**
 * Get the customer profile by customer ID.
 */
export async function getCustomerById(customerId: string): Promise<CustomerRow | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .eq('is_active', true)
    .maybeSingle()
  return data ? (data as CustomerRow) : null
}

function createHashSha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
