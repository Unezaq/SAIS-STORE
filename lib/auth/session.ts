import 'server-only'
import { cookies } from 'next/headers'

/** Cookie name for the customer session token. */
export const CUSTOMER_SESSION_COOKIE = 'sais_customer_session'

/** Session lifetime: 30 days. */
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60 // seconds

/**
 * Read the customer session token from cookies.
 * Returns null if no cookie is present.
 */
export async function readSessionCookie(): Promise<string | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(CUSTOMER_SESSION_COOKIE)
  return cookie?.value ?? null
}

/**
 * Set the customer session cookie (HttpOnly, Secure, SameSite=Lax).
 * Called from a Server Action after successful login or registration.
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(CUSTOMER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

/**
 * Clear the customer session cookie.
 * Called from a Server Action on logout.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(CUSTOMER_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
