import { describe, it, expect, beforeEach, vi } from 'vitest'

import { SupabaseMock } from '../lib/supabase-mock'

const supabaseMock = new SupabaseMock()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => supabaseMock,
}))

import {
  findCustomerByIdentifier,
  createCustomerRecord,
  createCustomerSession,
  validateSessionToken,
  revokeSession,
  revokeAllCustomerSessions,
  type CustomerRow,
} from '@/lib/auth/customers'
import { hashPassword } from '@/lib/auth/password'

const testCustomer: Partial<CustomerRow> = {
  id: 'cust-123',
  full_name: 'Test Customer',
  email: 'test@example.com',
  normalized_email: 'test@example.com',
  phone: '+212612345678',
  normalized_phone: '+212612345678',
  city: 'Kenitra',
  address: '123 Rue Test',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

beforeEach(() => {
  supabaseMock.reset()
  vi.restoreAllMocks()
})

describe('customer registration flow', () => {
  it('finds no existing customer for a new email', async () => {
    const result = await findCustomerByIdentifier('new@example.com')
    expect(result.customer).toBeNull()
    expect(result.credential).toBeNull()
  })

  it('finds an existing customer by email', async () => {
    supabaseMock.from('customers').insert([testCustomer as any])

    const result = await findCustomerByIdentifier('test@example.com')
    expect(result.customer).not.toBeNull()
    expect(result.customer?.email).toBe('test@example.com')
  })

  it('finds an existing customer by phone', async () => {
    supabaseMock.from('customers').insert([testCustomer as any])

    const result = await findCustomerByIdentifier('+212612345678')
    expect(result.customer).not.toBeNull()
    expect(result.customer?.phone).toBe('+212612345678')
  })

  it('creates a customer record and credential', async () => {
    const passwordHash = await hashPassword('TestPass123')

    const result = await createCustomerRecord({
      fullName: 'New Customer',
      email: 'new@example.com',
      normalizedEmail: 'new@example.com',
      phone: '+212612345678',
      normalizedPhone: '+212612345678',
      city: 'Casablanca',
      address: '456 Rue Nouvelle',
      passwordHash,
    })

    expect(result.customer.id).toBeDefined()
    expect(result.customer.full_name).toBe('New Customer')
    expect(result.customer.email).toBe('new@example.com')
    expect(result.customer.is_active).toBe(true)
    expect(result.credential.customer_id).toBe(result.customer.id)
    expect(result.credential.password_hash).toBe(passwordHash)
  })

  it('detects duplicate email', async () => {
    supabaseMock.from('customers').insert([testCustomer as any])

    const existing = await findCustomerByIdentifier('test@example.com')
    expect(existing.customer).not.toBeNull()
  })

  it('detects duplicate phone', async () => {
    supabaseMock.from('customers').insert([testCustomer as any])

    const existing = await findCustomerByIdentifier('+212612345678')
    expect(existing.customer).not.toBeNull()
  })
})

describe('customer session management', () => {
  it('creates a session and validates it', async () => {
    supabaseMock.from('customers').insert([testCustomer as any])

    const { sessionToken, session } = await createCustomerSession(testCustomer.id as string)

    expect(sessionToken).toBeDefined()
    expect(session.customer_id).toBe(testCustomer.id)
    expect(session.session_token_hash).toBeDefined()
    expect(session.revoked_at).toBeNull()

    // Validate the session
    const customer = await validateSessionToken(sessionToken)
    expect(customer).not.toBeNull()
    expect(customer?.id).toBe(testCustomer.id)
  })

  it('rejects an invalid session token', async () => {
    const customer = await validateSessionToken('invalid-token')
    expect(customer).toBeNull()
  })

  it('revokes a session on logout', async () => {
    supabaseMock.from('customers').insert([testCustomer as any])

    const { sessionToken } = await createCustomerSession(testCustomer.id as string)

    // Validate before revoke
    let customer = await validateSessionToken(sessionToken)
    expect(customer).not.toBeNull()

    // Revoke
    await revokeSession(sessionToken)

    // Validate after revoke
    customer = await validateSessionToken(sessionToken)
    expect(customer).toBeNull()
  })

  it('rotates sessions (revokes old ones on new login)', async () => {
    supabaseMock.from('customers').insert([testCustomer as any])

    const { sessionToken: token1 } = await createCustomerSession(testCustomer.id as string)
    const { sessionToken: token2 } = await createCustomerSession(testCustomer.id as string)

    // First session should be revoked
    let customer = await validateSessionToken(token1)
    expect(customer).toBeNull()

    // Second session should still work
    customer = await validateSessionToken(token2)
    expect(customer).not.toBeNull()
  })

  it('rejects inactive customers', async () => {
    const inactiveCustomer = { ...testCustomer, id: 'cust-inactive', is_active: false }
    supabaseMock.from('customers').insert([inactiveCustomer as any])

    const { sessionToken } = await createCustomerSession(inactiveCustomer.id as string)
    const customer = await validateSessionToken(sessionToken)
    expect(customer).toBeNull()
  })
})
