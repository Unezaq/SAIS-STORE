'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { ensureClientProfile, updateClientProfileByAuthUserId } from '@/lib/store'
import { bootstrapConfiguredAdmin } from '@/lib/supabase/bootstrap-admin'
import { getAuthenticatedUser } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'

function formString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function invalidInput(): { ok: false; error: string } {
  return { ok: false, error: 'Veuillez vérifier les informations saisies.' }
}

function normalizeMoroccanPhone(value: string): string | null {
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

function signupErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'user_already_exists':
    case 'phone_exists':
      return 'Un compte utilise déjà ce numéro. Connectez-vous ou utilisez un autre numéro.'
    case 'weak_password':
      return 'Le mot de passe est trop faible. Choisissez un mot de passe plus robuste.'
    case 'over_email_send_rate_limit':
    case 'over_sms_send_rate_limit':
    case 'over_phone_send_rate_limit':
      return 'Trop de tentatives. Attendez quelques minutes avant de réessayer.'
    case 'signup_disabled':
      return 'Les inscriptions sont actuellement désactivées. Contactez SAIS.'
    case 'phone_provider_disabled':
      return 'La création de comptes par téléphone est désactivée. Contactez SAIS.'
    case 'phone_not_allowed':
    case 'invalid_phone':
      return 'Saisissez un numéro de téléphone marocain valide.'
    default:
      return 'Impossible de créer ce compte. Vérifiez les informations ou connectez-vous.'
  }
}

export async function loginAction(formData: FormData) {
  const parsed = z.object({
    identifier: z.string().trim().min(1).max(254),
    password: z.string().min(1).max(256),
  }).safeParse({
    identifier: formString(formData, 'identifier'),
    password: formString(formData, 'password'),
  })
  if (!parsed.success) return invalidInput()

  const { identifier, password } = parsed.data
  let credentials: { email: string; password: string } | { phone: string; password: string } | null
  if (identifier.includes('@')) {
    const email = identifier.toLowerCase()
    credentials = z.email().safeParse(email).success ? { email, password } : null
  } else {
    const phone = normalizeMoroccanPhone(identifier)
    credentials = phone ? { phone, password } : null
  }
  if (!credentials) return invalidInput()

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(credentials)
  if (error) return { ok: false, error: 'Email ou mot de passe incorrect.' }

  const isBootstrapAdmin = data.user
    ? await bootstrapConfiguredAdmin(data.user.id)
    : false
  if (isBootstrapAdmin) {
    const { error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) throw refreshError
  }

  return { ok: true, isBootstrapAdmin }
}

export async function logoutClientAction() {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  redirect('/')
}

export async function updateClientProfileAction(formData: FormData) {
  const phone = normalizeMoroccanPhone(formString(formData, 'phone'))
  const parsed = z.object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    phone: z.string().regex(/^\+212[5-7]\d{8}$/),
    address: z.string().trim().min(1).max(500),
  }).safeParse({
    firstName: formString(formData, 'firstName'),
    lastName: formString(formData, 'lastName'),
    phone: phone ?? '',
    address: formString(formData, 'address'),
  })
  if (!parsed.success) return invalidInput()

  const user = await getAuthenticatedUser()
  if (!user) {
    return { ok: false, error: 'Connectez-vous pour modifier vos informations.' }
  }

  await updateClientProfileByAuthUserId({
    authUserId: user.id,
    email: user.email ?? null,
    ...parsed.data,
  })

  revalidatePath('/account')
  revalidatePath('/checkout')
  return { ok: true }
}

export async function registerClientAction(formData: FormData) {
  const phone = normalizeMoroccanPhone(formString(formData, 'phone'))
  const parsed = z.object({
    email: z.union([z.email(), z.literal('')]),
    password: z.string().min(8).max(128),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    phone: z.string().regex(/^\+212[5-7]\d{8}$/),
    address: z.string().trim().min(1).max(500),
  }).safeParse({
    email: formString(formData, 'email').toLowerCase(),
    password: formString(formData, 'password'),
    firstName: formString(formData, 'firstName'),
    lastName: formString(formData, 'lastName'),
    phone: phone ?? '',
    address: formString(formData, 'address'),
  })
  if (!parsed.success) return invalidInput()

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    phone: parsed.data.phone,
    password: parsed.data.password,
    options: {
      data: {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        phone: parsed.data.phone,
        address: parsed.data.address,
        contact_email: parsed.data.email || null,
      },
    },
  })

  if (error) {
    console.error('Supabase customer signup failed.', {
      code: error.code ?? 'unknown',
      status: error.status,
    })
    return { ok: false, error: signupErrorMessage(error.code) }
  }
  if (!data.user || data.user.identities?.length === 0) {
    return { ok: false, error: 'Un compte avec ce numéro existe peut-être déjà.' }
  }

  if (!data.session) {
    return {
      ok: false,
      error: 'La confirmation du téléphone est activée dans Supabase. Désactivez-la pour permettre une inscription sans vérification.',
    }
  }

  try {
    await ensureClientProfile({
      authUserId: data.user.id,
      email: parsed.data.email || null,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone,
      address: parsed.data.address,
    })
  } catch (profileError) {
    console.error('Failed to save customer profile after signup.', profileError)
    return {
      ok: false,
      error: 'Votre compte a été créé, mais son profil n’a pas pu être enregistré. Contactez SAIS pour finaliser le compte.',
    }
  }
  const isBootstrapAdmin = await bootstrapConfiguredAdmin(data.user.id)
  if (isBootstrapAdmin) {
    const { error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) throw refreshError
  }

  revalidatePath('/account')
  return { ok: true, isBootstrapAdmin }
}
