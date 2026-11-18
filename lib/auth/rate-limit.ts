import 'server-only'

/**
 * lib/auth/rate-limit.ts — In-memory rate limiter for customer auth endpoints.
 *
 * WARNING: This is in-memory and does NOT provide protection across multiple
 * server instances. For production deployment behind a load balancer with more
 * than one instance, replace this with a Redis-backed rate limiter.
 *
 * Tracks per-IP and per-identifier (email/phone) failure counts separately.
 * After MAX_FAILURES failures within the window, the key is locked for
 * LOCKOUT_SECONDS.
 */

interface RateLimitEntry {
  count: number
  windowStart: number
  lockedUntil: number
}

const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_FAILURES = 5
const LOCKOUT_SECONDS = 15 * 60 // 15 minutes

// Per-IP failure tracking (e.g. IP address as key)
const ipFailureMap = new Map<string, RateLimitEntry>()

// Per-identifier failure tracking (e.g. normalized email or phone as key)
const identifierFailureMap = new Map<string, RateLimitEntry>()

function nowMs(): number {
  return Date.now()
}

function getEntry(
  map: Map<string, RateLimitEntry>,
  key: string
): RateLimitEntry {
  let entry = map.get(key)
  if (!entry || nowMs() > entry.windowStart + WINDOW_MS) {
    entry = { count: 0, windowStart: nowMs(), lockedUntil: 0 }
    map.set(key, entry)
  }
  return entry
}

/**
 * Check if a key is currently rate-limited (locked).
 * Returns { allowed: false, retryAfterSeconds } if locked,
 * { allowed: true } otherwise.
 */
function isLocked(map: Map<string, RateLimitEntry>, key: string): {
  allowed: boolean
  retryAfterSeconds?: number
} {
  const entry = getEntry(map, key)
  if (entry.lockedUntil > nowMs()) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.lockedUntil - nowMs()) / 1000),
    }
  }
  return { allowed: true }
}

/**
 * Record a failure for a key. If failures exceed MAX_FAILURES within the
 * window, lock the key for LOCKOUT_SECONDS.
 */
function recordFailure(map: Map<string, RateLimitEntry>, key: string): void {
  const entry = getEntry(map, key)
  entry.count += 1
  if (entry.count >= MAX_FAILURES) {
    entry.lockedUntil = nowMs() + LOCKOUT_SECONDS * 1000
  }
}

/**
 * Clear failure record for a key (called on successful auth).
 */
function clearFailure(map: Map<string, RateLimitEntry>, key: string): void {
  map.delete(key)
}

/**
 * Rate limit result.
 */
export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }

/**
 * Check and record rate limit for an IP address.
 * Returns { allowed: true } if the request may proceed,
 * { allowed: false, retryAfterSeconds } if the IP is locked.
 */
export function checkIpRateLimit(ip: string): RateLimitResult {
  const locked = isLocked(ipFailureMap, ip)
  if (!locked.allowed) {
    return { allowed: false, retryAfterSeconds: locked.retryAfterSeconds ?? 0 }
  }
  return { allowed: true }
}

/**
 * Record a failed authentication attempt for an IP.
 */
export function recordIpFailure(ip: string): void {
  recordFailure(ipFailureMap, ip)
}

/**
 * Clear IP failure record on successful auth.
 */
export function clearIpFailure(ip: string): void {
  clearFailure(ipFailureMap, ip)
}

/**
 * Check and record rate limit for a normalized identifier (email or phone).
 */
export function checkIdentifierRateLimit(
  identifier: string
): RateLimitResult {
  const locked = isLocked(identifierFailureMap, identifier)
  if (!locked.allowed) {
    return { allowed: false, retryAfterSeconds: locked.retryAfterSeconds ?? 0 }
  }
  return { allowed: true }
}

/**
 * Record a failed authentication attempt for an identifier.
 */
export function recordIdentifierFailure(identifier: string): void {
  recordFailure(identifierFailureMap, identifier)
}

/**
 * Clear identifier failure record on successful auth.
 */
export function clearIdentifierFailure(identifier: string): void {
  clearFailure(identifierFailureMap, identifier)
}
