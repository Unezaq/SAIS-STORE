'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from '@/lib/auth/password'
import { generateSessionToken, hashSessionToken } from '@/lib/auth/tokens'
import {
  createCustomerRecord,
  findCustomerByIdentifier,
  createCustomerSession,
  validateSessionToken,
  revokeSession,
  revokeAllCustomerSessions,
  getCustomerById,
  updateCustomerPassword,
  type CustomerRow,
} from '@/lib/auth/customers'
import {
  setSessionCookie,
  clearSessionCookie,
  readSessionCookie,
} from '@/lib/auth/session'
import { normalizeMoroccanPhone } from '@/lib/phone'

const INVALID_IDENTIFIER_ERROR = 'Numéro de téléphone ou email incorrect.'
const INVALID_PASSWORD_ERROR = 'Mot de passe incorrect.'
const GENERIC_ERROR = 'Une erreur est survenue. Vérifiez les informations saisies.'

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function formString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function invalidInput(): { ok: false; error: string } {
  return { ok: false, error: GENERIC_ERROR }
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

function normalizePhone(phone: string): string | null {
  return normalizeMoroccanPhone(phone)
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export type RegisterResult =
  | { ok: true; customerId: string }
  | { ok: false; error: string }

const registerSchema = z.object({
  fullName: z.string().trim().min(1, 'Nom complet requis').max(160),
  city: z.string().trim().min(1, 'Ville requise').max(100),
  address: z.string().trim().min(1, 'Adresse requise').max(500),
  email: z.string().email('Email invalide').max(254),
  phone: z.string().min(1, 'Téléphone requis'),
  password: z.string().min(1, 'Mot de passe requis'),
})

export async function registerCustomerAction(
  formData: FormData
): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse({
    fullName: formString(formData, 'fullName'),
    city: formString(formData, 'city'),
    address: formString(formData, 'address'),
    email: normalizeEmail(formString(formData, 'email')),
    phone: formString(formData, 'phone'),
    password: formString(formData, 'password'),
  })

  if (!parsed.success) {
    return invalidInput()
  }

  const { fullName, city, address, email, phone, password } = parsed.data

  // Password strength
  const strength = validatePasswordStrength(password)
  if (!strength.valid) {
    return { ok: false, error: strength.message ?? GENERIC_ERROR }
  }

  // Normalize phone
  const normalizedPhone = normalizePhone(phone)
  if (!normalizedPhone) {
    return { ok: false, error: 'Numéro de téléphone marocain invalide.' }
  }

  const normalizedEmail = normalizeEmail(email)

  try {
    // Check for duplicates — generic error to avoid account enumeration
    const existingEmail = await findCustomerByIdentifier(normalizedEmail)
    const existingPhone = await findCustomerByIdentifier(normalizedPhone)
    if (existingEmail.customer || existingPhone.customer) {
      return {
        ok: false,
        error: 'Un compte utilise déjà cet email ou ce numéro de téléphone.',
      }
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create customer + credential
    const { customer } = await createCustomerRecord({
      fullName,
      email: normalizedEmail,
      normalizedEmail,
      phone: normalizedPhone,
      normalizedPhone,
      city,
      address,
      passwordHash,
    })

    // Create session immediately (auto-login)
    const { sessionToken } = await createCustomerSession(customer.id)
    await setSessionCookie(sessionToken)

    revalidatePath('/account')
    return { ok: true, customerId: customer.id }
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export type LoginResult = { ok: true; customerId: string } | { ok: false; error: string }

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Identifiant requis').max(254),
  password: z.string().min(1, 'Mot de passe requis').max(256),
})

export async function loginCustomerAction(
  formData: FormData
): Promise<LoginResult> {
  const parsed = loginSchema.safeParse({
    identifier: formString(formData, 'identifier'),
    password: formString(formData, 'password'),
  })

  if (!parsed.success) {
    return invalidInput()
  }

  const { identifier, password } = parsed.data

  try {
    const { customer, credential } = await findCustomerByIdentifier(identifier)

    // Generic error if customer not found — prevents account enumeration
    if (!customer || !credential) {
      return { ok: false, error: INVALID_IDENTIFIER_ERROR }
    }

    // Inactive account — generic error
    if (!customer.is_active) {
      return { ok: false, error: INVALID_IDENTIFIER_ERROR }
    }

    // Verify password
    const isValid = await verifyPassword(password, credential.password_hash)
    if (!isValid) {
      return { ok: false, error: INVALID_PASSWORD_ERROR }
    }

    // Create new session (rotation) and set cookie
    const { sessionToken } = await createCustomerSession(customer.id)
    await setSessionCookie(sessionToken)

    revalidatePath('/account')
    return { ok: true, customerId: customer.id }
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function logoutCustomerAction(): Promise<{ ok: boolean }> {
  try {
    const token = await readSessionCookie()
    if (token) {
      await revokeSession(token)
    }
  } catch {
    // Ignore errors during logout — still clear the cookie
  }

  await clearSessionCookie()
  redirect('/')
}

// ---------------------------------------------------------------------------
// Get current authenticated customer from session cookie
// ---------------------------------------------------------------------------

export async function getAuthenticatedCustomer(): Promise<CustomerRow | null> {
  const token = await readSessionCookie()
  if (!token) return null

  try {
    return await validateSessionToken(token)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Require authenticated customer (throws redirect if not)
// ---------------------------------------------------------------------------

export async function requireCustomer(): Promise<CustomerRow> {
  const customer = await getAuthenticatedCustomer()
  if (!customer) {
    redirect('/login?next=%2Faccount')
  }
  return customer
}

// ---------------------------------------------------------------------------
// Change password
// ---------------------------------------------------------------------------

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: z.string().min(1, 'Nouveau mot de passe requis'),
})

export async function changeCustomerPasswordAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const customer = await getAuthenticatedCustomer()
  if (!customer) {
    return { ok: false, error: 'Connectez-vous pour modifier votre mot de passe.' }
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formString(formData, 'currentPassword'),
    newPassword: formString(formData, 'newPassword'),
  })

  if (!parsed.success) {
    return { ok: false, error: GENERIC_ERROR }
  }

  const { currentPassword, newPassword } = parsed.data

  const strength = validatePasswordStrength(newPassword)
  if (!strength.valid) {
    return { ok: false, error: strength.message }
  }

  // Fetch credential
  const { credential } = await findCustomerByIdentifier(customer.email || customer.phone)
  if (!credential) {
    return { ok: false, error: GENERIC_ERROR }
  }

  const isValid = await verifyPassword(currentPassword, credential.password_hash)
  if (!isValid) {
    return { ok: false, error: 'Mot de passe actuel incorrect.' }
  }

  const newHash = await hashPassword(newPassword)
  await updateCustomerPassword(customer.id, newHash)

  // Revoke all other sessions (force re-login on other devices)
  await revokeAllCustomerSessions(customer.id)

  revalidatePath('/account/profile')
  return { ok: true }
}
