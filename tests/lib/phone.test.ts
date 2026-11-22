import { describe, it, expect } from 'vitest'
import {
  normalizeMoroccanPhone,
  formatMoroccanPhone,
  phoneAuthEmail,
  whatsappNumber,
} from '@/lib/phone'

describe('Moroccan phone helpers', () => {
  it('normalizes local Moroccan format (06...) to +2126...', () => {
    expect(normalizeMoroccanPhone('0644816544')).toBe('+212644816544')
    expect(normalizeMoroccanPhone('0712345678')).toBe('+212712345678')
    expect(normalizeMoroccanPhone('0522123456')).toBe('+212522123456')
  })

  it('normalizes international format with spaces, dots, dashes', () => {
    expect(normalizeMoroccanPhone('+212 6 44 81 65 44')).toBe('+212644816544')
    expect(normalizeMoroccanPhone('00212-644-816544')).toBe('+212644816544')
    expect(normalizeMoroccanPhone('+212(0)644816544')).toBe('+212644816544')
  })

  it('rejects invalid or non-Moroccan phone numbers', () => {
    expect(normalizeMoroccanPhone('')).toBeNull()
    expect(normalizeMoroccanPhone('12345')).toBeNull()
    expect(normalizeMoroccanPhone('+33612345678')).toBeNull() // France
    expect(normalizeMoroccanPhone('0412345678')).toBeNull() // Invalid local prefix
  })

  it('formats Moroccan phone into readable national format', () => {
    expect(formatMoroccanPhone('+212644816544')).toBe('06 44 81 65 44')
  })

  it('generates internal auth email from phone', () => {
    expect(phoneAuthEmail('+212644816544')).toBe('212644816544@phone.sais.ma')
  })

  it('extracts WhatsApp number for wa.me links', () => {
    expect(whatsappNumber('+212 644-816544')).toBe('212644816544')
  })
})
