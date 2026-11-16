/**
 * lib/phone.ts — Moroccan phone helpers.
 * Every phone written to the database is stored as `+212XXXXXXXXX`, so a
 * customer can be identified the same way from the checkout, the account and
 * the public order tracking.
 */

export function normalizeMoroccanPhone(value: string): string | null {
  const compact = value.replace(/[\s().-]/g, '')
  const digits = compact.startsWith('+')
    ? compact.slice(1)
    : compact.startsWith('00')
      ? compact.slice(2)
      : compact
  const nationalNumber = digits.startsWith('212') ? digits.slice(3) : digits
  const localNumber = nationalNumber.startsWith('0')
    ? nationalNumber.slice(1)
    : nationalNumber

  return /^[5-7]\d{8}$/.test(localNumber) ? `+212${localNumber}` : null
}

/** +212644816544 → 06 44 81 65 44 */
export function formatMoroccanPhone(phone: string): string {
  const local = phone.replace(/^\+212/, '0')
  return /^\d{10}$/.test(local)
    ? local.replace(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5')
    : phone
}

/**
 * Accounts are created without an SMS provider, so a phone-first account uses
 * an internal email derived from the number. The customer still signs in with
 * their phone; this address is never shown and never receives mail.
 */
export function phoneAuthEmail(phone: string): string {
  return `${phone.replace(/\D/g, '')}@phone.sais.ma`
}

/** 212644816544 for wa.me links. */
export function whatsappNumber(phone: string): string {
  return phone.replace(/\D/g, '')
}
