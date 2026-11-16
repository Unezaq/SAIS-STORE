import { describe, it, expect } from 'vitest'
import { generateSessionToken, hashSessionToken } from '@/lib/auth/tokens'

describe('session token generation', () => {
  it('generates a cryptographically secure random token', () => {
    const token1 = generateSessionToken()
    const token2 = generateSessionToken()
    expect(token1).not.toBe(token2)
    expect(token1.length).toBeGreaterThan(32)
    expect(token2.length).toBeGreaterThan(32)
    // Should be hex-like (no dashes from UUID)
    expect(/^[a-f0-9]+$/.test(token1)).toBe(true)
  })

  it('produces tokens with sufficient entropy', () => {
    const tokens = new Set<string>()
    for (let i = 0; i < 100; i++) {
      tokens.add(generateSessionToken())
    }
    expect(tokens.size).toBe(100)
  })
})

describe('session token hashing', () => {
  it('hashes a token with SHA-256', () => {
    const token = 'abc123def456'
    const hash = hashSessionToken(token)
    expect(hash).toHaveLength(64) // SHA-256 hex = 64 chars
    expect(hash).not.toBe(token)
  })

  it('produces the same hash for the same token (deterministic)', () => {
    const token = 'test-token-123'
    expect(hashSessionToken(token)).toBe(hashSessionToken(token))
  })

  it('produces different hashes for different tokens', () => {
    expect(hashSessionToken('token-a')).not.toBe(hashSessionToken('token-b'))
  })
})
