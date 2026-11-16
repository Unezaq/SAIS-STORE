import { describe, it, expect } from 'vitest'
import { normalizeMoroccanPhone } from '@/lib/phone'

describe('Moroccan phone normalization', () => {
  it('normalizes a local format number', () => {
    expect(normalizeMoroccanPhone('06 12 34 56 78')).toBe('+212612345678')
  })

  it('normalizes with country code', () => {
    expect(normalizeMoroccanPhone('+212612345678')).toBe('+212612345678')
  })

  it('normalizes with 00 prefix', () => {
    expect(normalizeMoroccanPhone('00212612345678')).toBe('+212612345678')
  })

  it('normalizes with spaces and dots', () => {
    expect(normalizeMoroccanPhone('06.12.34.56.78')).toBe('+212612345678')
  })

  it('rejects invalid numbers', () => {
    expect(normalizeMoroccanPhone('0123456789')).toBeNull() // starts with 01
    expect(normalizeMoroccanPhone('123456')).toBeNull() // too short
    expect(normalizeMoroccanPhone('')).toBeNull()
    expect(normalizeMoroccanPhone('not a phone')).toBeNull()
  })

  it('rejects non-Moroccan prefixes', () => {
    expect(normalizeMoroccanPhone('+33612345678')).toBeNull() // French
    expect(normalizeMoroccanPhone('+1234567890')).toBeNull() // US
  })
})
