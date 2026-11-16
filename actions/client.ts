'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { normalizeMoroccanPhone, phoneAuthEmail } from '@/lib/phone'
import { ensureClientProfile, updateClientProfileByAuthUserId } from '@/lib/store'
import { createAdminClient } from '@/lib/supabase/admin'
import { bootstrapConfiguredAdmin } from '@/lib/supabase/bootstrap-admin'
import {
  AUTH_PROVIDERS_DISABLED_MESSAGE,
  getAuthenticatedUser,
  isAuthProviderDisabled,
} from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'

function formString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function invalidInput(): { ok: false; error: string } {
  return { ok: false, error: 'Veuillez vérifier les informations saisies.' }
}

function signupErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'user_already_exists':
    case 'phone_exists':
    case 'email_exists':
      return 'Un compte utilise déjà ce numéro ou cet email. Connectez-vous ou utilisez une autre adresse.'
    case 'weak_password':
      return 'Le mot de passe est trop faible. Choisissez un mot de passe plus robuste.'
    case 'over_email_send_rate_limit':
    case 'over_sms_send_rate_limit':
    case 'over_phone_send_rate_limit':
      return 'Trop de tentatives. Attendez quelques minutes avant de réessayer.'
    case 'signup_disabled':
      return 'Les inscriptions sont actuellement désactivées dans Supabase. Contactez SAIS.'
    case 'email_address_invalid':
      return 'Impossible de créer le compte : vérifiez l’adresse email saisie.'
    case 'email_provider_disabled':
    case 'phone_provider_disabled':
      return 'La création de comptes est désactivée dans Supabase (Authentication → Sign In / Providers). Contactez SAIS.'
    case 'phone_not_allowed':
    case 'invalid_phone':
      return 'Saisissez un numéro de téléphone marocain valide.'
    default:
      return 'Impossible de créer ce compte. Vérifiez les informations ou connectez-vous.'
  }
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Accepts an email or a Moroccan phone. Phone-first accounts are stored under
 * an internal email, so we try that identity first and keep the legacy phone
 * identity as a fallback.
 */
async function signInWithIdentifier(
  supabase: SupabaseServerClient,
  identifier: string,
  password: string
) {
  if (identifier.includes('@')) {
    const email = identifier.toLowerCase()
    if (!z.email().safeParse(email).success) return null
    return supabase.auth.signInWithPassword({ email, password })
  }

  const phone = normalizeMoroccanPhone(identifier)
  if (!phone) return null

  const byPhoneEmail = await supabase.auth.signInWithPassword({
    email: phoneAuthEmail(phone),
    password,
  })
  if (!byPhoneEmail.error) return byPhoneEmail

  return supabase.auth.signInWithPassword({ phone, password })
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
  const supabase = await createClient()
  const authResult = await signInWithIdentifier(supabase, identifier, password)
  if (!authResult || authResult.error) {
    if (isAuthProviderDisabled(authResult?.error?.code)) {
      return { ok: false, error: AUTH_PROVIDERS_DISABLED_MESSAGE }
    }
    return { ok: false, error: 'Email, téléphone ou mot de passe incorrect.' }
  }

  const data = authResult.data
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
  // Phone-first store: creating an account never depends on an SMS provider
  // and never waits for an email confirmation. The account is created through
  // the admin API as already confirmed, then signed in to set the session.
  // Without a real email, it uses an internal address derived from the phone;
  // the customer still signs in with the phone number.
  const authEmail = parsed.data.email || phoneAuthEmail(parsed.data.phone)
  const admin = createAdminClient()
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: authEmail,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      phone: parsed.data.phone,
      address: parsed.data.address,
      contact_email: parsed.data.email || null,
    },
  })

  if (createError) {
    console.error('Supabase customer creation failed.', {
      code: createError.code ?? 'unknown',
      status: createError.status,
    })
    return { ok: false, error: signupErrorMessage(createError.code) }
  }

  const newUser = created.user
  if (!newUser) {
    return { ok: false, error: 'Impossible de créer ce compte. Réessayez ou contactez SAIS.' }
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password: parsed.data.password,
  })
  if (signInError) {
    console.error('New customer could not be signed in.', signInError)

    if (isAuthProviderDisabled(signInError.code)) {
      // Sign-in is switched off in Supabase: remove the orphan account so the
      // customer can register again once the provider is enabled.
      const { error: rollbackError } = await admin.auth.admin.deleteUser(newUser.id)
      if (rollbackError) console.error('Could not roll back the new account.', rollbackError)
      return { ok: false, error: AUTH_PROVIDERS_DISABLED_MESSAGE }
    }

    return {
      ok: false,
      error:
        'Votre compte a été créé, mais la connexion automatique a échoué. Connectez-vous avec votre téléphone et votre mot de passe.',
    }
  }

  try {
    await ensureClientProfile(
      {
        authUserId: newUser.id,
        email: parsed.data.email || null,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone,
        address: parsed.data.address,
      },
      // Link the guest orders placed earlier with this phone or email.
      { allowEmailBasedLinking: true }
    )
  } catch (profileError) {
    console.error('Failed to save customer profile after signup.', profileError)
    return {
      ok: false,
      error: 'Votre compte a été créé, mais son profil n’a pas pu être enregistré. Contactez SAIS pour finaliser le compte.',
    }
  }
  const isBootstrapAdmin = await bootstrapConfiguredAdmin(newUser.id)
  if (isBootstrapAdmin) {
    const { error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) throw refreshError
  }

  revalidatePath('/account')
  return { ok: true, isBootstrapAdmin }
}
