import 'server-only'
import { createHash, randomUUID } from 'node:crypto'

/**
 * Generate a cryptographically secure random session token.
 * Uses randomUUID() twice for 128+ bits of entropy.
 */
export function generateSessionToken(): string {
  return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
}

/**
 * Hash a session token with SHA-256 for storage in the database.
 * Raw tokens are never stored.
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
