'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { normalizeMoroccanPhone } from '@/lib/phone'
import { getAuthenticatedCustomer } from '@/actions/customer-auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const GENERIC_ERROR = 'Une erreur est survenue. Vérifiez les informations saisies.'

function formString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function invalidInput(): { ok: false; error: string } {
  return { ok: false, error: GENERIC_ERROR }
}

const updateProfileSchema = z.object({
  fullName: z.string().trim().max(160).optional(),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(160).optional(),
  city: z.string().trim().max(100).optional(),
  address: z.string().trim().min(1, 'Adresse requise').max(500),
  email: z.string().email('Email invalide').toLowerCase().trim().max(254).optional(),
  phone: z.string().min(1, 'Téléphone requis'),
})

export type UpdateProfileResult =
  | { ok: true }
  | { ok: false; error: string }

export async function updateCustomerProfileAction(
  formData: FormData
): Promise<UpdateProfileResult> {
  const customer = await getAuthenticatedCustomer()
  if (!customer) {
    return { ok: false, error: 'Connectez-vous pour modifier votre profil.' }
  }

  const parsed = updateProfileSchema.safeParse({
    fullName: formString(formData, 'fullName'),
    firstName: formString(formData, 'firstName'),
    lastName: formString(formData, 'lastName'),
    city: formString(formData, 'city'),
    address: formString(formData, 'address'),
    email: formString(formData, 'email') || undefined,
    phone: formString(formData, 'phone'),
  })

  if (!parsed.success) {
    return invalidInput()
  }

  const fullName =
    parsed.data.fullName?.trim() ||
    [parsed.data.firstName, parsed.data.lastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ')
      .trim()
  if (!fullName) {
    return invalidInput()
  }

  const city = parsed.data.city?.trim() || customer.city?.trim()
  if (!city) {
    return invalidInput()
  }

  const { address, email, phone } = parsed.data

  const normalizedPhone = normalizeMoroccanPhone(phone)
  if (!normalizedPhone) {
    return { ok: false, error: 'Numéro de téléphone marocain invalide.' }
  }

  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    // Check phone uniqueness — generic errors to avoid enumeration
    if (normalizedPhone && normalizedPhone !== customer.phone) {
      const { data: existingPhone } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', normalizedPhone)
        .neq('id', customer.id)
        .maybeSingle()
      if (existingPhone) {
        return { ok: false, error: 'Ce numéro de téléphone est déjà utilisé par un autre compte.' }
      }
    }

    // Update email via Supabase Auth if changed
    if (email && email !== customer.email) {
      const { error: emailError } = await supabase.auth.updateUser({ email })
      if (emailError) {
        return { ok: false, error: 'Impossible de modifier l\'email.' }
      }
    }

    // Update profile in profiles table
    const { error } = await admin
      .from('profiles')
      .update({
        full_name: fullName,
        city,
        address,
        phone: normalizedPhone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customer.id)

    if (error) throw error

    revalidatePath('/account/profile')
    revalidatePath('/account')
    return { ok: true }
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }
}
