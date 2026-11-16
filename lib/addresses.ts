/**
 * lib/addresses.ts — Saved addresses for authenticated customers.
 * RLS ensures a user can only touch their own rows.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { StoreAddress } from '@/lib/types/store'

export async function getAddresses(userId: string): Promise<StoreAddress[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as StoreAddress[]
}

export async function upsertAddress(
  userId: string,
  address: Partial<StoreAddress> & { id?: string }
): Promise<void> {
  const supabase = await createClient()

  // If setting as default, unset other defaults for this user first
  if (address.isDefault) {
    await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', userId)
  }

  const { error } = await supabase
    .from('addresses')
    .upsert({
      id: address.id,
      user_id: userId,
      label: address.label,
      full_name: address.fullName,
      phone: address.phone,
      city: address.city,
      address: address.address,
      is_default: address.isDefault,
    }, { onConflict: 'id' })

  if (error) throw error
}

export async function deleteAddress(userId: string, id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function getDefaultAddress(userId: string): Promise<StoreAddress | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as StoreAddress | null
}

export async function getAdminAddresses(): Promise<StoreAddress[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as StoreAddress[]
}
