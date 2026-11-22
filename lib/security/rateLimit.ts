/**
 * lib/security/rateLimit.ts — In-memory rate limiting.
 * Protects public endpoints (checkout, tracking) against automated abuse.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

export interface RateLimitOptions {
  max: number
  windowMs: number
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { max: 10, windowMs: 60 * 60 * 1000 }
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + options.windowMs,
    })
    return { allowed: true }
  }

  if (entry.count >= options.max) {
    return { allowed: false, retryAfter: entry.resetAt - now }
  }

  entry.count += 1
  return { allowed: true }
}
