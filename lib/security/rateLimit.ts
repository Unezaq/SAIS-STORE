/**
 * lib/security/rateLimit.ts — Database-backed fixed-window rate limiting.
 *
 * Primary store: PostgreSQL SECURITY DEFINER function
 * public.check_rate_limit(identifier, max, window_ms), which performs an
 * atomic UPSERT on public.rate_limits. This survives restarts and works
 * across server instances.
 *
 * Window type: FIXED WINDOW (not Token Bucket). Each (identifier,
 * window_start) row counts requests within a fixed time bucket. A caller can
 * therefore observe up to 2× the limit across a window boundary; this is a
 * known, accepted trade-off.
 *
 * FAILURE MODE: if PostgreSQL is unreachable, the request is NOT silently
 * unlimited. A bounded in-process fixed-window counter takes over for that
 * server instance. This keeps sensitive endpoints (checkout, tracking,
 * upload) protected during a database blip while preserving availability.
 * The fallback is per-instance and resets on restart, so it is
 * defence-in-depth only — the database remains the authoritative limiter.
 *
 * All writes happen inside the SECURITY DEFINER function (service_role
 * privileges), so the caller only needs EXECUTE on the function — no direct
 * table access required.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export interface RateLimitOptions {
  max: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfter?: number // milliseconds until the window resets
}

interface FallbackEntry {
  count: number
  resetAt: number
}

const FALLBACK_MAX_ENTRIES = 5000
const fallbackStore = new Map<string, FallbackEntry>()

let dbWarningEmitted = false

function normalizeOptions(options: RateLimitOptions): RateLimitOptions {
  return {
    max: Math.max(1, Math.floor(options.max)),
    windowMs: Math.max(1000, Math.floor(options.windowMs)),
  }
}

/**
 * Bounded per-process fixed-window counter used only when the database
 * limiter is unavailable. Never grows without bound.
 */
function fallbackCheck(identifier: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now()

  if (fallbackStore.size >= FALLBACK_MAX_ENTRIES) {
    // Drop expired entries first; if still full, drop the oldest insertion.
    for (const [key, entry] of fallbackStore) {
      if (now >= entry.resetAt) fallbackStore.delete(key)
    }
    if (fallbackStore.size >= FALLBACK_MAX_ENTRIES) {
      const oldest = fallbackStore.keys().next().value
      if (oldest !== undefined) fallbackStore.delete(oldest)
    }
  }

  let entry = fallbackStore.get(identifier)
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + options.windowMs }
    fallbackStore.set(identifier, entry)
  }

  entry.count += 1

  if (entry.count > options.max) {
    return { allowed: false, retryAfter: Math.max(0, entry.resetAt - now) }
  }

  return { allowed: true }
}

export async function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { max: 10, windowMs: 60 * 60 * 1000 }
): Promise<RateLimitResult> {
  const safeOptions = normalizeOptions(options)

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_max: safeOptions.max,
      p_window_ms: safeOptions.windowMs,
    })

    if (error) {
      if (!dbWarningEmitted) {
        console.error('[rateLimit] database error, using in-process fallback', error)
        dbWarningEmitted = true
      }
      return fallbackCheck(identifier, safeOptions)
    }

    const row = (data ?? [])[0]
    return {
      allowed: row?.allowed ?? true,
      retryAfter: row?.retry_after_ms ?? undefined,
    }
  } catch (error) {
    if (!dbWarningEmitted) {
      console.error('[rateLimit] unexpected error, using in-process fallback', error)
      dbWarningEmitted = true
    }
    return fallbackCheck(identifier, safeOptions)
  }
}
