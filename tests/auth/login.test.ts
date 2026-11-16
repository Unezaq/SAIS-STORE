import { describe, it, expect, beforeEach, vi } from 'vitest'

import { SupabaseMock } from '../lib/supabase-mock'

const supabaseMock = new SupabaseMock()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => supabaseMock,
}))

vi.mock('@/lib/auth/session', () => ({
  CUSTOMER_SESSION_COOKIE: 'sais_customer_session',
  SESSION_MAX_AGE: 30 * 24 * 60 * 60,
  readSessionCookie: vi.fn(() => null),
  setSessionCookie: vi.fn(() => Promise.resolve()),
  clearSessionCookie: vi.fn(() => Promise.resolve()),
}))

import { loginCustomerAction, registerCustomerAction } from '@/actions/customer-auth'
import { findCustomerByIdentifier } from '@/lib/auth/customers'
import { hashPassword } from '@/lib/auth/password'
import type { CustomerRow } from '@/lib/auth/customers'

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

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  supabaseMock.reset()
  vi.restoreAllMocks()
})

async function seedCustomerWithPassword(overrides: Partial<CustomerRow> = {}) {
  const customer = { ...testCustomer, ...overrides }
  const passwordHash = await hashPassword('TestPass123')

  supabaseMock.from('customers').insert([customer as any])
  supabaseMock.from('customer_credentials').insert([
    {
      id: 'cred-123',
      customer_id: customer.id,
      password_hash: passwordHash,
      password_updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    } as any,
  ])

  return customer
}

describe('customer login', () => {
  it('logs in with email', async () => {
    await seedCustomerWithPassword()

    const result = await loginCustomerAction(
      formData({ identifier: 'test@example.com', password: 'TestPass123' })
    )

    console.log('LOGIN RESULT:', JSON.stringify(result, null, 2))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.customerId).toBe('cust-123')
  })

  it('logs in with phone number', async () => {
    await seedCustomerWithPassword()

    const result = await loginCustomerAction(
      formData({ identifier: '+212612345678', password: 'TestPass123' })
    )

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.customerId).toBe('cust-123')
  })

  it('rejects incorrect password', async () => {
    await seedCustomerWithPassword()

    const result = await loginCustomerAction(
      formData({ identifier: 'test@example.com', password: 'WrongPass123' })
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('Mot de passe incorrect.')
  })

  it('rejects unknown account (email)', async () => {
    const result = await loginCustomerAction(
      formData({ identifier: 'unknown@example.com', password: 'TestPass123' })
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('Numéro de téléphone ou email incorrect.')
  })

  it('rejects unknown account (phone)', async () => {
    const result = await loginCustomerAction(
      formData({ identifier: '+212699999999', password: 'TestPass123' })
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('Numéro de téléphone ou email incorrect.')
  })

  it('rejects inactive account', async () => {
    await seedCustomerWithPassword({ id: 'cust-inactive', is_active: false })

    const result = await loginCustomerAction(
      formData({ identifier: 'test@example.com', password: 'TestPass123' })
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('Numéro de téléphone ou email incorrect.')
  })

  it('reveals no information about whether account exists', async () => {
    const unknownResult = await loginCustomerAction(
      formData({ identifier: 'nonexistent@example.com', password: 'TestPass123' })
    )

    await seedCustomerWithPassword()
    const wrongPasswordResult = await loginCustomerAction(
      formData({ identifier: 'test@example.com', password: 'WrongPass123' })
    )

    expect(unknownResult.ok).toBe(false)
    expect(wrongPasswordResult.ok).toBe(false)
  })
})

describe('findCustomerByIdentifier (direct)', () => {
  it('finds customer by normalized email', async () => {
    supabaseMock.from('customers').insert([testCustomer as any])
    supabaseMock.from('customer_credentials').insert([{
      id: 'cred-1',
      customer_id: testCustomer.id,
      password_hash: 'hash',
    } as any])

    const result = await findCustomerByIdentifier('test@example.com')
    expect(result.customer).not.toBeNull()
    expect(result.customer?.email).toBe('test@example.com')
    expect(result.credential).not.toBeNull()
  })

  it('finds customer by normalized phone', async () => {
    supabaseMock.from('customers').insert([testCustomer as any])
    supabaseMock.from('customer_credentials').insert([{
      id: 'cred-1',
      customer_id: testCustomer.id,
      password_hash: 'hash',
    } as any])

    const result = await findCustomerByIdentifier('+212612345678')
    expect(result.customer).not.toBeNull()
    expect(result.customer?.phone).toBe('+212612345678')
  })

  it('returns null for unknown email', async () => {
    const result = await findCustomerByIdentifier('unknown@example.com')
    expect(result.customer).toBeNull()
    expect(result.credential).toBeNull()
  })
})

describe('customer registration (auto-login)', () => {
  it('successfully registers and auto-logs in', async () => {
    const result = await registerCustomerAction(
      formData({
        fullName: 'New Customer',
        city: 'Casablanca',
        address: '456 Rue Nouvelle',
        email: 'new@example.com',
        phone: '06 12 34 56 78',
        password: 'TestPass123',
      })
    )

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.customerId).toBeDefined()
  })

  it('rejects duplicate email on registration', async () => {
    await registerCustomerAction(
      formData({
        fullName: 'Customer One',
        city: 'Casablanca',
        address: '456 Rue Nouvelle',
        email: 'dup@example.com',
        phone: '06 11 11 11 11',
        password: 'TestPass123',
      })
    )

    const result = await registerCustomerAction(
      formData({
        fullName: 'Customer Two',
        city: 'Rabat',
        address: '789 Avenue',
        email: 'DUP@EXAMPLE.COM',
        phone: '06 22 22 22 22',
        password: 'TestPass123',
      })
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('déjà')
  })

  it('rejects duplicate phone on registration', async () => {
    await registerCustomerAction(
      formData({
        fullName: 'Customer One',
        city: 'Casablanca',
        address: '456 Rue Nouvelle',
        email: 'one@example.com',
        phone: '06 33 33 33 33',
        password: 'TestPass123',
      })
    )

    const result = await registerCustomerAction(
      formData({
        fullName: 'Customer Two',
        city: 'Rabat',
        address: '789 Avenue',
        email: 'two@example.com',
        phone: '0633333333',
        password: 'TestPass123',
      })
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('déjà')
  })

  it('rejects invalid email', async () => {
    const result = await registerCustomerAction(
      formData({
        fullName: 'Bad Email',
        city: 'Casablanca',
        address: '456 Rue',
        email: 'not-an-email',
        phone: '06 44 44 44 44',
        password: 'TestPass123',
      })
    )

    expect(result.ok).toBe(false)
  })

  it('rejects invalid phone', async () => {
    const result = await registerCustomerAction(
      formData({
        fullName: 'Bad Phone',
        city: 'Casablanca',
        address: '456 Rue',
        email: 'badphone@example.com',
        phone: '01 23 45 67 89',
        password: 'TestPass123',
      })
    )

    expect(result.ok).toBe(false)
  })

  it('rejects weak password', async () => {
    const result = await registerCustomerAction(
      formData({
        fullName: 'Weak Pass',
        city: 'Casablanca',
        address: '456 Rue',
        email: 'weak@example.com',
        phone: '06 55 55 55 55',
        password: '123',
      })
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('caractère')
  })

  it('rejects missing fields', async () => {
    const result = await registerCustomerAction(
      formData({
        fullName: '',
        city: '',
        address: '',
        email: '',
        phone: '',
        password: '',
      })
    )

    expect(result.ok).toBe(false)
  })
})
