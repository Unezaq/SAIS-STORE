'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

/**
 * lib/auth/supabase.ts — Supabase Auth pour les customers.
 * Remplace le custom auth (customers / customer_credentials / customer_sessions).
 * Le profil est créé automatiquement via le trigger DB handle_new_user.
 */

export type CustomerProfile = {
  id: string
  email: string | null
  full_name: string | null
  phone: string | null
  address: string | null
  role: string
  created_at: string
  updated_at: string
}

export async function signUpCustomer(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const fullName = String(formData.get('fullName') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const address = String(formData.get('address') ?? '').trim()

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone, address }
    }
  })

  if (error) return { ok: false, error: error.message }
  if (!data.user) return { ok: false, error: 'Impossible de créer le compte.' }

  return { ok: true, user: data.user }
}

export async function signInCustomer(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { ok: false, error: 'Email ou mot de passe incorrect.' }
  if (!data.user) return { ok: false, error: 'Impossible de se connecter.' }

  return { ok: true, user: data.user }
}

export async function signOutCustomer() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

export async function getCurrentCustomer() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return { user, profile } as { user: typeof user; profile: CustomerProfile | null }
}

export async function requireAuth() {
  const customer = await getCurrentCustomer()
  if (!customer) redirect('/login?next=%2Faccount')
  return customer
}

export async function updateCustomerPassword(formData: FormData) {
  const currentPassword = String(formData.get('currentPassword') ?? '')
  const newPassword = String(formData.get('newPassword') ?? '')

  const customer = await getCurrentCustomer()
  if (!customer) return { ok: false, error: 'Connectez-vous pour modifier votre mot de passe.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  })

  if (error) return { ok: false, error: error.message }

  // Révoquer toutes les sessions côté client n'est pas nécessaire avec Supabase Auth
  // (le mot de passe changé invalide les sessions existantes).
  revalidatePath('/account/profile')
  return { ok: true }
}
