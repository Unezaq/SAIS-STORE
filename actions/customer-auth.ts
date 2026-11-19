'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { normalizeMoroccanPhone } from '@/lib/phone'

const INVALID_IDENTIFIER_ERROR = 'Numéro de téléphone ou email incorrect.'
const INVALID_PASSWORD_ERROR = 'Mot de passe incorrect.'
const GENERIC_ERROR = 'Une erreur est survenue. Vérifiez les informations saisies.'

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
// Registration (Supabase Auth + profiles trigger creates the profile)
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

  const normalizedPhone = normalizePhone(phone)
  if (!normalizedPhone) {
    return { ok: false, error: 'Numéro de téléphone marocain invalide.' }
  }

  try {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: normalizedPhone,
          city,
          address,
        },
      },
    })

    if (error) {
      // Generic error to avoid account enumeration
      return { ok: false, error: 'Impossible de créer ce compte.' }
    }

    if (!data.user) {
      return { ok: false, error: 'Impossible de créer ce compte.' }
    }

    // Session is automatically set by signUp. Profile is created by the
    // database trigger handle_new_user().
    revalidatePath('/account')
    return { ok: true, customerId: data.user.id }
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }
}

// ---------------------------------------------------------------------------
// Login (Supabase Auth)
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
  const supabase = await createClient()

  // Try email first, then phone (Supabase Auth only handles email natively;
  // phone-first users log in with the internal email derived from their phone).
  const signInEmail = identifier.includes('@')
    ? identifier.toLowerCase()
    : undefined

  let authResult = await supabase.auth.signInWithPassword({
    email: signInEmail ?? '',
    password,
  })

  if (authResult.error && !identifier.includes('@')) {
    // Fallback: phone-first accounts use an internal email.
    const phoneEmail = `${identifier.replace(/\D/g, '')}@phone.sais.ma`
    authResult = await supabase.auth.signInWithPassword({
      email: phoneEmail,
      password,
    })
  }

  if (authResult.error) {
    return { ok: false, error: INVALID_IDENTIFIER_ERROR }
  }

  if (!authResult.data.user) {
    return { ok: false, error: INVALID_IDENTIFIER_ERROR }
  }

  revalidatePath('/account')
  return { ok: true, customerId: authResult.data.user.id }
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function logoutCustomerAction(): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

// ---------------------------------------------------------------------------
// Get current authenticated customer from Supabase session
// ---------------------------------------------------------------------------

export type CustomerSession = {
  id: string
  email: string | null
  full_name: string | null
  phone: string | null
  city: string | null
  address: string | null
  role: string | null
}

export async function getAuthenticatedCustomer(): Promise<CustomerSession | null> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, city, address, role')
    .eq('id', user.id)
    .maybeSingle()

  return {
    id: user.id,
    email: user.email ?? null,
    full_name: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    city: profile?.city ?? null,
    address: profile?.address ?? null,
    role: profile?.role ?? null,
  }
}

// ---------------------------------------------------------------------------
// Require authenticated customer (throws redirect if not)
// ---------------------------------------------------------------------------

export async function requireCustomer(): Promise<CustomerSession> {
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
  newPassword: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
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

  const { newPassword } = parsed.data

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/account/profile')
  return { ok: true }
}
