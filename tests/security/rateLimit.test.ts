import { describe, it, expect } from 'vitest'
import { checkRateLimit } from '@/lib/security/rateLimit'

describe('Rate limiting', () => {
  it('allows requests within limit', () => {
    const id = `test-phone-${Date.now()}`
    const result1 = checkRateLimit(id, { max: 3, windowMs: 10000 })
    expect(result1.allowed).toBe(true)

    const result2 = checkRateLimit(id, { max: 3, windowMs: 10000 })
    expect(result2.allowed).toBe(true)

    const result3 = checkRateLimit(id, { max: 3, windowMs: 10000 })
    expect(result3.allowed).toBe(true)
  })

  it('blocks requests exceeding limit', () => {
    const id = `test-blocked-${Date.now()}`
    checkRateLimit(id, { max: 2, windowMs: 10000 })
    checkRateLimit(id, { max: 2, windowMs: 10000 })

    const blocked = checkRateLimit(id, { max: 2, windowMs: 10000 })
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThan(0)
  })
})
