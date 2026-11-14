'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { ensureClientProfile, updateClientProfileByAuthUserId } from '@/lib/store'
import { clientEnv } from '@/lib/env'
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

export async function loginAction(formData: FormData) {
  const parsed = z.object({
    email: z.email(),
    password: z.string().min(1).max(256),
  }).safeParse({
    email: formString(formData, 'email').toLowerCase(),
    password: formString(formData, 'password'),
  })
  if (!parsed.success) return invalidInput()

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error?.code === 'email_not_confirmed') {
    return {
      ok: false,
      error: 'Confirmez votre adresse email avec le lien reçu avant de vous connecter.',
    }
  }
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
  const parsed = z.object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    phone: z.string().trim().regex(/^\+?[\d\s()-]{9,18}$/),
    address: z.string().trim().min(1).max(500),
  }).safeParse({
    firstName: formString(formData, 'firstName'),
    lastName: formString(formData, 'lastName'),
    phone: formString(formData, 'phone'),
    address: formString(formData, 'address'),
  })
  if (!parsed.success) return invalidInput()

  const user = await getAuthenticatedUser()
  if (!user?.email) {
    return { ok: false, error: 'Connectez-vous pour modifier vos informations.' }
  }

  await updateClientProfileByAuthUserId({
    authUserId: user.id,
    email: user.email,
    ...parsed.data,
  })

  revalidatePath('/account')
  revalidatePath('/checkout')
  return { ok: true }
}

export async function registerClientAction(formData: FormData) {
  const parsed = z.object({
    email: z.email(),
    password: z.string().min(8).max(128),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    phone: z.string().trim().regex(/^\+?[\d\s()-]{9,18}$/),
    address: z.string().trim().max(500),
  }).safeParse({
    email: formString(formData, 'email').toLowerCase(),
    password: formString(formData, 'password'),
    firstName: formString(formData, 'firstName'),
    lastName: formString(formData, 'lastName'),
    phone: formString(formData, 'phone'),
    address: formString(formData, 'address'),
  })
  if (!parsed.success) return invalidInput()

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        phone: parsed.data.phone,
        address: parsed.data.address,
      },
      emailRedirectTo: `${clientEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/account`,
    },
  })

  if (error) {
    return { ok: false, error: 'Impossible de créer ce compte. Vérifiez les informations ou connectez-vous.' }
  }
  if (!data.user || data.user.identities?.length === 0) {
    return { ok: false, error: 'Un compte avec cette adresse existe peut-être déjà.' }
  }

  const requiresEmailConfirmation = !data.session
  let isBootstrapAdmin = false
  if (data.session) {
    try {
      await ensureClientProfile({
        authUserId: data.user.id,
        email: parsed.data.email,
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
    isBootstrapAdmin = await bootstrapConfiguredAdmin(data.user.id)
    if (isBootstrapAdmin && data.session) {
      const { error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) throw refreshError
    }
  }

  revalidatePath('/account')
  return { ok: true, requiresEmailConfirmation, isBootstrapAdmin }
}
