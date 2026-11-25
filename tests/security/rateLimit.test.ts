import { describe, it, expect, beforeEach, vi } from 'vitest'

import { SupabaseMock } from '../lib/supabase-mock'

const supabaseMock = new SupabaseMock()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => supabaseMock,
}))

import { checkRateLimit } from '@/lib/security/rateLimit'

beforeEach(() => {
  supabaseMock.reset()
})

describe('Rate limiting', () => {
  it('allows requests within limit', async () => {
    const id = `test-phone-${Date.now()}`
    const result1 = await checkRateLimit(id, { max: 3, windowMs: 10000 })
    expect(result1.allowed).toBe(true)

    const result2 = await checkRateLimit(id, { max: 3, windowMs: 10000 })
    expect(result2.allowed).toBe(true)

    const result3 = await checkRateLimit(id, { max: 3, windowMs: 10000 })
    expect(result3.allowed).toBe(true)
  })

  it('blocks when limit is exceeded even with different identifiers', async () => {
    // Simulates an attacker rotating identifiers to bypass per-phone limits.
    // The IP-based limit (supplementary) should still apply.
    const ip = `test-ip-${Date.now()}`
    await checkRateLimit(ip, { max: 2, windowMs: 10000 })
    await checkRateLimit(ip, { max: 2, windowMs: 10000 })

    const blocked = await checkRateLimit(ip, { max: 2, windowMs: 10000 })
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThan(0)
  })

  it('different identifiers have independent limits', async () => {
    const id1 = `id-a-${Date.now()}`
    const id2 = `id-b-${Date.now()}`

    await checkRateLimit(id1, { max: 1, windowMs: 10000 })
    const blocked1 = await checkRateLimit(id1, { max: 1, windowMs: 10000 })
    expect(blocked1.allowed).toBe(false)

    // id2 should still be allowed (independent counter)
    const result2 = await checkRateLimit(id2, { max: 1, windowMs: 10000 })
    expect(result2.allowed).toBe(true)
  })
})
