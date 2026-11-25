'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AUTH_PROVIDERS_DISABLED_MESSAGE, isAuthProviderDisabled } from '@/lib/security/auth'
import { normalizeMoroccanPhone } from '@/lib/phone'
import { getOrdersByUserId } from '@/lib/store'
import type { StoreOrder } from '@/lib/types/store'

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
 * created unconfirmed (email confirmation is not auto-granted), then a normal
 * password session is attempted so the visitor can sign in if the project's
 * email provider allows unconfirmed sign-ins. No admin role is ever assigned.
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
    // Never auto-confirm: email confirmation must come from the actual auth
    // flow. email_confirm: false leaves the account unconfirmed until the
    // project's email provider verifies it. No admin role is ever assigned.
    email_confirm: false,
    user_metadata: {
      full_name: parsed.data.fullName,
      phone,
      role: 'customer',
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

/* ------------------------------------------------------------------------
 * Customer profile (read / update personal information)
 * ------------------------------------------------------------------------ */

export type CustomerProfile = {
  id: string
  email: string | null
  fullName: string | null
  phone: string | null
}

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Indiquez votre nom complet.').max(80).optional(),
  phone: z.string().trim().max(20).optional().nullable(),
})

export async function getCustomerProfile(): Promise<CustomerProfile | null> {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return null

  const metadata = user.user.user_metadata ?? {}
  return {
    id: user.user.id,
    email: user.user.email ?? null,
    fullName:
      (typeof metadata.full_name === 'string' && metadata.full_name) ||
      user.user.email?.split('@')[0] ||
      null,
    phone: typeof metadata.phone === 'string' ? metadata.phone : null,
  }
}

export async function updateCustomerProfile(formData: FormData): Promise<AccountActionResult> {
  const parsed = updateProfileSchema.safeParse({
    fullName: formString(formData, 'fullName'),
    phone: formString(formData, 'phone') || undefined,
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Vérifiez vos informations.' }
  }

  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) {
    return { ok: false, error: 'Vous devez être connecté(e) pour modifier votre profil.' }
  }

  const updates: Record<string, unknown> = {}
  if (parsed.data.fullName !== undefined) updates.full_name = parsed.data.fullName
  if (parsed.data.phone !== undefined) {
    const phone = parsed.data.phone ? normalizeMoroccanPhone(parsed.data.phone) : null
    if (parsed.data.phone && !phone) {
      return { ok: false, error: INVALID_PHONE }
    }
    updates.phone = phone
  }

  const { error } = await supabase.auth.updateUser({
    data: updates,
  })

  if (error) {
    return { ok: false, error: 'Impossible de mettre à jour votre profil. Réessayez.' }
  }

  // Keep the public.profiles table in sync (used by admin RLS / role checks).
  const sync: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.fullName !== undefined) sync.full_name = parsed.data.fullName
  if (parsed.data.phone !== undefined) sync.phone = updates.phone

  await supabase.from('profiles').upsert({
    id: user.user.id,
    ...sync,
  })

  revalidatePath('/compte')
  return { ok: true }
}

/* ------------------------------------------------------------------------
 * Customer addresses (multiple delivery addresses per signed-in client)
 *
 * Data writes use the admin client (service role) — exactly like
 * lib/services/orders.service.ts and lib/services/clients.service.ts — and
 * ownership is enforced manually by checking the authenticated user's id
 * against user_id on every row. RLS stays enabled as a defense-in-depth layer.
 * ------------------------------------------------------------------------ */

export type CustomerAddress = {
  id: string
  label: string
  firstName: string
  lastName: string
  phone: string
  city: string
  address: string
  isDefault: boolean
}

const addressSchema = z.object({
  label: z.string().trim().min(1).max(40),
  firstName: z.string().trim().min(2, 'Indiquez votre prénom.').max(80),
  lastName: z.string().trim().min(2, 'Indiquez votre nom.').max(80),
  phone: z.string().trim().min(1),
  city: z.string().trim().min(1).max(100),
  address: z.string().trim().min(10, 'Précisez votre adresse (quartier, rue).').max(500),
  isDefault: z.boolean().optional(),
})

/** Returns the authenticated user id, or null if not signed in. */
async function authUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data?.user?.id ?? null
}

export async function getCustomerAddresses(): Promise<CustomerAddress[]> {
  const userId = await authUserId()
  if (!userId) return []

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    label: String(row.label ?? 'Adresse'),
    firstName: String(row.first_name ?? ''),
    lastName: String(row.last_name ?? ''),
    phone: String(row.phone ?? ''),
    city: String(row.city ?? 'Casablanca'),
    address: String(row.address ?? ''),
    isDefault: Boolean(row.is_default),
  }))
}

export async function addCustomerAddress(formData: FormData): Promise<AccountActionResult> {
  const parsed = addressSchema.safeParse({
    label: formString(formData, 'label'),
    firstName: formString(formData, 'firstName'),
    lastName: formString(formData, 'lastName'),
    phone: formString(formData, 'phone'),
    city: formString(formData, 'city'),
    address: formString(formData, 'address'),
    isDefault: formString(formData, 'isDefault') === 'on',
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Vérifiez vos informations.' }
  }

  const phone = normalizeMoroccanPhone(parsed.data.phone)
  if (!phone) {
    return { ok: false, error: INVALID_PHONE }
  }

  const userId = await authUserId()
  if (!userId) {
    return { ok: false, error: 'Vous devez être connecté(e) pour ajouter une adresse.' }
  }

  const supabase = createAdminClient()

  // If this is set as default, unset any other default for this user.
  if (parsed.data.isDefault) {
    await supabase
      .from('customer_addresses')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true)
  }

  const { error } = await supabase.from('customer_addresses').insert({
    user_id: userId,
    label: parsed.data.label,
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    phone,
    city: parsed.data.city,
    address: parsed.data.address,
    is_default: parsed.data.isDefault,
  })

  if (error) {
    console.error('[customer-account] addCustomerAddress failed', error)
    return { ok: false, error: 'Impossible d’ajouter cette adresse. Réessayez.' }
  }

  revalidatePath('/compte')
  return { ok: true }
}

export async function updateCustomerAddress(formData: FormData): Promise<AccountActionResult> {
  const parsed = z
    .object({
      id: z.string().uuid('Identifiant d’adresse invalide.'),
      ...addressSchema.shape,
    })
    .safeParse({
      id: formString(formData, 'id'),
      label: formString(formData, 'label'),
      firstName: formString(formData, 'firstName'),
      lastName: formString(formData, 'lastName'),
      phone: formString(formData, 'phone'),
      city: formString(formData, 'city'),
      address: formString(formData, 'address'),
      isDefault: formString(formData, 'isDefault') === 'on',
    })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Vérifiez vos informations.' }
  }

  const phone = normalizeMoroccanPhone(parsed.data.phone)
  if (!phone) {
    return { ok: false, error: INVALID_PHONE }
  }

  const userId = await authUserId()
  if (!userId) {
    return { ok: false, error: 'Vous devez être connecté(e) pour modifier une adresse.' }
  }

  const supabase = createAdminClient()

  // Verify ownership before touching anything.
  const { data: existing } = await supabase
    .from('customer_addresses')
    .select('id')
    .eq('id', parsed.data.id)
    .eq('user_id', userId)
    .maybeSingle()
  if (!existing) {
    return { ok: false, error: 'Adresse introuvable.' }
  }

  if (parsed.data.isDefault) {
    await supabase
      .from('customer_addresses')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true)
  }

  const { error } = await supabase
    .from('customer_addresses')
    .update({
      label: parsed.data.label,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      phone,
      city: parsed.data.city,
      address: parsed.data.address,
      is_default: parsed.data.isDefault,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id)
    .eq('user_id', userId)

  if (error) {
    console.error('[customer-account] updateCustomerAddress failed', error)
    return { ok: false, error: 'Impossible de modifier cette adresse. Réessayez.' }
  }

  revalidatePath('/compte')
  return { ok: true }
}

export async function deleteCustomerAddress(formData: FormData): Promise<AccountActionResult> {
  const id = formString(formData, 'id')
  if (!id) {
    return { ok: false, error: 'Identifiant d’adresse manquant.' }
  }

  const userId = await authUserId()
  if (!userId) {
    return { ok: false, error: 'Vous devez être connecté(e) pour supprimer une adresse.' }
  }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('customer_addresses')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error('[customer-account] deleteCustomerAddress failed', error)
    return { ok: false, error: 'Impossible de supprimer cette adresse. Réessayez.' }
  }

  revalidatePath('/compte')
  return { ok: true }
}

export async function setDefaultAddress(formData: FormData): Promise<AccountActionResult> {
  const id = formString(formData, 'id')
  if (!id) {
    return { ok: false, error: 'Identifiant d’adresse manquant.' }
  }

  const userId = await authUserId()
  if (!userId) {
    return { ok: false, error: 'Vous devez être connecté(e) pour choisir une adresse par défaut.' }
  }

  const supabase = createAdminClient()

  // Unset every default address for this user, then flag the chosen one.
  await supabase
    .from('customer_addresses')
    .update({ is_default: false })
    .eq('user_id', userId)
    .eq('is_default', true)

  const { error } = await supabase
    .from('customer_addresses')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error('[customer-account] setDefaultAddress failed', error)
    return { ok: false, error: 'Impossible de définir cette adresse par défaut.' }
  }

  revalidatePath('/compte')
  return { ok: true }
}

/* ------------------------------------------------------------------------
 * Delivery address memory (checkout → account)
 * ------------------------------------------------------------------------ */

export interface DeliveryAddressInput {
  /** Id of the saved address picked at checkout, when there was one. */
  addressId?: string
  customerName: string
  phone: string
  city: string
  address: string
}

const deliveryAddressSchema = z.object({
  addressId: z.string().uuid().optional(),
  customerName: z.string().trim().min(3).max(160),
  phone: z.string().regex(/^\+212[5-7]\d{8}$/),
  city: z.string().trim().min(1).max(100),
  address: z.string().trim().min(10).max(500),
})

/**
 * Remembers the delivery address used for an order in the signed-in
 * customer's account, so the next checkout is pre-filled with it instead of
 * asking for everything again. The address just used becomes the default;
 * other saved addresses are kept untouched.
 *
 * Best-effort by design: any failure is logged and swallowed — remembering
 * an address must never block or fail an order. Guests are simply ignored.
 */
export async function rememberDeliveryAddress(input: DeliveryAddressInput): Promise<void> {
  try {
    const parsed = deliveryAddressSchema.safeParse(input)
    if (!parsed.success) return

    const userId = await authUserId()
    if (!userId) return

    const { addressId, customerName, phone, city, address } = parsed.data
    const [firstName, ...rest] = customerName.split(/\s+/)
    const lastName = rest.join(' ')

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('user_id', userId)
    if (error) {
      console.error('[customer-account] rememberDeliveryAddress read failed', error)
      return
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>
    const sameDelivery = (row: Record<string, unknown>) =>
      String(row.first_name ?? '') === firstName &&
      String(row.last_name ?? '') === lastName &&
      String(row.phone ?? '') === phone &&
      String(row.city ?? '') === city &&
      String(row.address ?? '') === address

    // The address picked at checkout wins; otherwise reuse an identical
    // saved address instead of creating a duplicate.
    const target =
      (addressId ? rows.find((row) => String(row.id) === addressId) : undefined) ??
      rows.find(sameDelivery)

    if (target) {
      // Already the default and unchanged: nothing to write.
      if (sameDelivery(target) && Boolean(target.is_default)) return

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (!sameDelivery(target)) {
        Object.assign(updates, {
          first_name: firstName,
          last_name: lastName,
          phone,
          city,
          address,
        })
      }
      if (!Boolean(target.is_default)) {
        await supabase
          .from('customer_addresses')
          .update({ is_default: false })
          .eq('user_id', userId)
          .eq('is_default', true)
        updates.is_default = true
      }
      await supabase
        .from('customer_addresses')
        .update(updates)
        .eq('id', String(target.id))
        .eq('user_id', userId)
    } else {
      // First address ever, or a brand new one: save it as the default.
      await supabase
        .from('customer_addresses')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('is_default', true)

      const { error: insertError } = await supabase.from('customer_addresses').insert({
        user_id: userId,
        label: 'Adresse',
        first_name: firstName,
        last_name: lastName,
        phone,
        city,
        address,
        is_default: true,
      })
      if (insertError) {
        console.error('[customer-account] rememberDeliveryAddress insert failed', insertError)
        return
      }
    }

    revalidatePath('/compte')
    revalidatePath('/checkout')
  } catch (error) {
    console.error('[customer-account] rememberDeliveryAddress failed', error)
  }
}

/* ------------------------------------------------------------------------
 * Customer orders (orders linked to the signed-in client)
 * ------------------------------------------------------------------------ */

export async function getCustomerOrders(): Promise<StoreOrder[]> {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return []

  return getOrdersByUserId(user.user.id)
}

/* ------------------------------------------------------------------------
 * Change password
 * ------------------------------------------------------------------------ */

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Saisissez votre mot de passe actuel.'),
  newPassword: z
    .string()
    .min(8, 'Le nouveau mot de passe doit contenir au moins 8 caractères.')
    .max(72),
})

export async function changePasswordAction(formData: FormData): Promise<AccountActionResult> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formString(formData, 'currentPassword'),
    newPassword: formString(formData, 'newPassword'),
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Vérifiez vos informations.' }
  }

  const supabase = await createClient()
  const { data: user, error: getUserError } = await supabase.auth.getUser()
  if (getUserError || !user?.user) {
    return { ok: false, error: 'Vous devez être connecté(e) pour changer votre mot de passe.' }
  }

  // Verify the current password by attempting a sign-in with it.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.user.email ?? '',
    password: parsed.data.currentPassword,
  })
  if (signInError) {
    return { ok: false, error: 'Mot de passe actuel incorrect.' }
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  })

  if (error) {
    return { ok: false, error: 'Impossible de changer le mot de passe. Réessayez.' }
  }

  revalidatePath('/compte')
  return { ok: true }
}
