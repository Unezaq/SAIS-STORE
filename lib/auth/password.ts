import 'server-only'
import { hash, compare } from 'bcryptjs'

const SALT_ROUNDS = 12

/**
 * Hash a password using bcrypt (secure salted hash).
 * Note: bcryptjs is used because it is already a project dependency and
 * works in the Next.js serverless runtime. Argon2id can be swapped in
 * when the argon2 package is available.
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, SALT_ROUNDS)
}

/**
 * Verify a plaintext password against a stored hash.
 */
export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return compare(password, passwordHash)
}

/**
 * Enforce reasonable password strength.
 */
export function validatePasswordStrength(password: string): {
  valid: boolean
  message?: string
} {
  if (password.length < 8) {
    return {
      valid: false,
      message: 'Le mot de passe doit contenir au moins 8 caractères.',
    }
  }
  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: 'Le mot de passe doit contenir au moins une minuscule.',
    }
  }
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: 'Le mot de passe doit contenir au moins une majuscule.',
    }
  }
  if (!/\d/.test(password)) {
    return {
      valid: false,
      message: 'Le mot de passe doit contenir au moins un chiffre.',
    }
  }
  return { valid: true }
}
