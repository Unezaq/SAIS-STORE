import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/auth/password'

describe('password hashing', () => {
  it('hashes and verifies a password correctly', async () => {
    const hash = await hashPassword('TestPass123')
    expect(hash).not.toBe('TestPass123')
    expect(hash.length).toBeGreaterThan(20)

    const isValid = await verifyPassword('TestPass123', hash)
    expect(isValid).toBe(true)

    const isInvalid = await verifyPassword('WrongPass123', hash)
    expect(isInvalid).toBe(false)
  })

  it('produces different hashes for the same password (salting)', async () => {
    const hash1 = await hashPassword('TestPass123')
    const hash2 = await hashPassword('TestPass123')
    expect(hash1).not.toBe(hash2)
  })
})

describe('password strength validation', () => {
  it('accepts a strong password', () => {
    const result = validatePasswordStrength('TestPass123')
    expect(result.valid).toBe(true)
  })

  it('rejects short passwords', () => {
    const result = validatePasswordStrength('Ab1')
    expect(result.valid).toBe(false)
    expect(result.message).toContain('8 caractères')
  })

  it('rejects passwords without lowercase', () => {
    const result = validatePasswordStrength('ABCD1234')
    expect(result.valid).toBe(false)
    expect(result.message).toContain('minuscule')
  })

  it('rejects passwords without uppercase', () => {
    const result = validatePasswordStrength('abcd1234')
    expect(result.valid).toBe(false)
    expect(result.message).toContain('majuscule')
  })

  it('rejects passwords without digits', () => {
    const result = validatePasswordStrength('AbcdEfgh')
    expect(result.valid).toBe(false)
    expect(result.message).toContain('chiffre')
  })

  it('rejects empty password', () => {
    const result = validatePasswordStrength('')
    expect(result.valid).toBe(false)
  })
})
