/**
 * Tiny className merge utility (clsx/tailwind-merge compatible subset).
 * Accepts strings, numbers, booleans, undefined/null — falsy values are dropped.
 * Kept dependency-free per the project's current package.json.
 */
export function cn(...classes: unknown[]) {
  return classes.filter(Boolean).map(String).join(' ')
}

/**
 * Format a price in Moroccan Dirham (MAD), e.g. 490 → "490,00 dh".
 * Per AGENTS.md: new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' })
 */
export function formatMAD(price: number) {
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}
