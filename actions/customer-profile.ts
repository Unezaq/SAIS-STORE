'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { normalizeMoroccanPhone } from '@/lib/phone'
import { getCustomerFromSession } from '@/lib/auth/current-customer'
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
  fullName: z.string().trim().min(1, 'Nom complet requis').max(160),
  city: z.string().trim().min(1, 'Ville requise').max(100),
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
  const customer = await getCustomerFromSession()
  if (!customer) {
    return { ok: false, error: 'Connectez-vous pour modifier votre profil.' }
  }

  const parsed = updateProfileSchema.safeParse({
    fullName: formString(formData, 'fullName'),
    city: formString(formData, 'city'),
    address: formString(formData, 'address'),
    email: formString(formData, 'email') || undefined,
    phone: formString(formData, 'phone'),
  })

  if (!parsed.success) {
    return invalidInput()
  }

  const { fullName, city, address, email, phone } = parsed.data

  const normalizedPhone = normalizeMoroccanPhone(phone)
  if (!normalizedPhone) {
    return { ok: false, error: 'Numéro de téléphone marocain invalide.' }
  }

  let normalizedEmail: string | undefined
  if (email) {
    normalizedEmail = email.toLowerCase().trim()
  }

  try {
    const supabase = createAdminClient()

    // Check uniqueness — generic errors to avoid enumeration
    if (normalizedEmail && normalizedEmail !== customer.normalized_email) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('normalized_email', normalizedEmail)
        .neq('id', customer.id)
        .maybeSingle()
      if (existing) {
        return { ok: false, error: 'Cet email est déjà utilisé par un autre compte.' }
      }
    }

    const { data: existingPhone } = await supabase
      .from('customers')
      .select('id')
      .eq('normalized_phone', normalizedPhone)
      .neq('id', customer.id)
      .maybeSingle()
    if (existingPhone) {
      return { ok: false, error: 'Ce numéro de téléphone est déjà utilisé par un autre compte.' }
    }

    // Update customer
    const { error } = await supabase
      .from('customers')
      .update({
        full_name: fullName,
        city,
        address,
        email: normalizedEmail ?? customer.email,
        normalized_email: normalizedEmail ?? customer.normalized_email,
        phone: normalizedPhone,
        normalized_phone: normalizedPhone,
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
