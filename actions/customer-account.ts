'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AUTH_PROVIDERS_DISABLED_MESSAGE, isAuthProviderDisabled } from '@/lib/security/auth'
import { normalizeMoroccanPhone } from '@/lib/phone'

export type AccountActionResult = { ok: true } | { ok: false; error: string }

const INVALID_PHONE = 'Numéro marocain invalide (ex. 06 12 34 56 78).'

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Indiquez votre nom complet.').max(80),
  email: z.email('Email invalide.'),
  phone: z.string().trim().max(20).optional(),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.').max(72),
})

const loginSchema = z.object({
  email: z.email('Email invalide.'),
  password: z.string().min(1, 'Saisissez votre mot de passe.').max(256),
})

function formString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Optional customer account.
 *
 * Guest checkout stays the default, so this never blocks a sale. The account is
 * created confirmed (the project has no SMS provider and `mailer_autoconfirm`
 * is off), then a normal password session is opened so the visitor is signed in
 * immediately — no email round trip, no ghost account.
 */
export async function registerAccountAction(formData: FormData): Promise<AccountActionResult> {
  const parsed = registerSchema.safeParse({
    fullName: formString(formData, 'fullName'),
    email: formString(formData, 'email').toLowerCase(),
    phone: formString(formData, 'phone'),
    password: formString(formData, 'password'),
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Vérifiez vos informations.' }
  }

  const phone = parsed.data.phone ? normalizeMoroccanPhone(parsed.data.phone) : null
  if (parsed.data.phone && !phone) {
    return { ok: false, error: INVALID_PHONE }
  }

  const admin = createAdminClient()
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.fullName,
      phone,
    },
  })

  if (createError || !created.user) {
    const alreadyExists =
      createError?.code === 'email_exists' || /already/i.test(createError?.message ?? '')
    return {
      ok: false,
      error: alreadyExists
        ? 'Un compte existe déjà avec cet email. Utilisez « Se connecter ».'
        : 'Impossible de créer le compte pour le moment. Réessayez dans un instant.',
    }
  }

  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (signInError) {
    if (isAuthProviderDisabled(signInError.code)) {
      // Never leave an unusable account behind when the provider is switched off.
      await admin.auth.admin.deleteUser(created.user.id)
      return { ok: false, error: AUTH_PROVIDERS_DISABLED_MESSAGE }
    }
    return {
      ok: false,
      error: 'Votre compte est créé, mais la connexion automatique a échoué. Utilisez « Se connecter ».',
    }
  }

  revalidatePath('/compte')
  return { ok: true }
}

export async function loginAccountAction(formData: FormData): Promise<AccountActionResult> {
  const parsed = loginSchema.safeParse({
    email: formString(formData, 'email').toLowerCase(),
    password: formString(formData, 'password'),
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Vérifiez vos informations.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    if (isAuthProviderDisabled(error.code)) {
      return { ok: false, error: AUTH_PROVIDERS_DISABLED_MESSAGE }
    }
    return { ok: false, error: 'Email ou mot de passe incorrect.' }
  }

  revalidatePath('/compte')
  return { ok: true }
}

export async function logoutAccountAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/compte')
  redirect('/compte')
}
