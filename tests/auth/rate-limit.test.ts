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
import {
  checkIdentifierRateLimit,
  recordIdentifierFailure,
  clearIdentifierFailure,
} from '@/lib/auth/rate-limit'
import { hashPassword } from '@/lib/auth/password'
import type { CustomerRow } from '@/lib/auth/customers'

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  supabaseMock.reset()
  vi.restoreAllMocks()
})

describe('rate limiter (unit)', () => {
  it('allows requests under the limit', () => {
    const result = checkIdentifierRateLimit('test@example.com')
    expect(result.allowed).toBe(true)
  })

  it('locks after MAX_FAILURES failures', () => {
    const key = 'lockout-test@example.com'
    for (let i = 0; i < 5; i++) {
      recordIdentifierFailure(key)
    }
    const result = checkIdentifierRateLimit(key)
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0)
    }
  })

  it('clears lockout on success', () => {
    const key = 'clear-test@example.com'
    for (let i = 0; i < 5; i++) {
      recordIdentifierFailure(key)
    }
    expect(checkIdentifierRateLimit(key).allowed).toBe(false)
    clearIdentifierFailure(key)
    expect(checkIdentifierRateLimit(key).allowed).toBe(true)
  })
})

describe('login rate limiting', () => {
  const seedCustomer = async () => {
    const passwordHash = await hashPassword('TestPass123')
    supabaseMock.from('customers').insert([{
      id: 'cust-rl',
      full_name: 'RL Customer',
      email: 'rl@example.com',
      normalized_email: 'rl@example.com',
      phone: '+212612345678',
      normalized_phone: '+212612345678',
      city: 'Kenitra',
      address: '1 Rue Test',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any])
    supabaseMock.from('customer_credentials').insert([{
      id: 'cred-rl',
      customer_id: 'cust-rl',
      password_hash: passwordHash,
      password_updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    } as any])
  }

  it('locks after 5 failed login attempts with same identifier', async () => {
    await seedCustomer()

    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      const result = await loginCustomerAction(
        formData({ identifier: 'rl@example.com', password: 'WrongPass123' })
      )
      expect(result.ok).toBe(false)
    }

    // 6th attempt should be rate-limited
    const result = await loginCustomerAction(
      formData({ identifier: 'rl@example.com', password: 'TestPass123' })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Trop de tentatives')
    }
  })

  it('allows login after lockout clears (simulated)', async () => {
    await seedCustomer()

    // Clear any prior failures
    clearIdentifierFailure('rl@example.com')

    const result = await loginCustomerAction(
      formData({ identifier: 'rl@example.com', password: 'TestPass123' })
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.customerId).toBe('cust-rl')
  })
})

describe('registration rate limiting', () => {
  it('locks after 5 failed registration attempts with same email', async () => {
    // First successful registration
    await registerCustomerAction(
      formData({
        fullName: 'RL Customer',
        city: 'Casablanca',
        address: '1 Rue Test',
        email: 'rreg@example.com',
        phone: '06 11 11 11 11',
        password: 'TestPass123',
      })
    )

    // 5 failed attempts with same email (duplicate)
    for (let i = 0; i < 5; i++) {
      const result = await registerCustomerAction(
        formData({
          fullName: 'RL Customer',
          city: 'Casablanca',
          address: '1 Rue Test',
          email: 'rreg@example.com',
          phone: '06 22 22 22 22',
          password: 'TestPass123',
        })
      )
      expect(result.ok).toBe(false)
    }

    // 6th attempt should be rate-limited
    const result = await registerCustomerAction(
      formData({
        fullName: 'RL Customer',
        city: 'Casablanca',
        address: '1 Rue Test',
        email: 'rreg@example.com',
        phone: '06 33 33 33 33',
        password: 'TestPass123',
      })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Trop de tentatives')
    }
  })
})
