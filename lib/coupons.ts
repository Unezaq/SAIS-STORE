/**
 * lib/coupons.ts — Coupon management via Supabase RPC.
 * All validation happens server-side; the client never sees coupon data
 * except the result of validation.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { StoreCoupon, CouponValidationResult } from '@/lib/types/store'

type CouponRow = {
  id: string
  code: string
  type: 'percentage' | 'fixed'
  value: number
  min_order: number
  starts_at: string
  expires_at: string | null
  max_uses: number | null
  used_count: number
  per_user_limit: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/** The coupons table is snake_case; the admin UI reads StoreCoupon. */
function mapCoupon(row: CouponRow): StoreCoupon {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    value: row.value,
    minOrder: row.min_order,
    startsAt: row.starts_at,
    expiresAt: row.expires_at ?? undefined,
    maxUses: row.max_uses ?? undefined,
    usedCount: row.used_count,
    perUserLimit: row.per_user_limit ?? undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getCoupons(): Promise<StoreCoupon[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    // Table may not exist yet during build or before migrations are applied
    return []
  }
  return ((data ?? []) as CouponRow[]).map(mapCoupon)
}

export async function upsertCoupon(coupon: Partial<StoreCoupon> & { id?: string }): Promise<void> {
  const supabase = createAdminClient()
  const values = {
    code: coupon.code?.toLowerCase(),
    type: coupon.type,
    value: coupon.value,
    min_order: coupon.minOrder,
    starts_at: coupon.startsAt,
    expires_at: coupon.expiresAt ?? null,
    max_uses: coupon.maxUses ?? null,
    per_user_limit: coupon.perUserLimit ?? null,
    is_active: coupon.isActive,
  }

  // Editing sends an id so the row is updated even when its code changes.
  const { error } = coupon.id
    ? await supabase.from('coupons').update(values).eq('id', coupon.id)
    : await supabase.from('coupons').upsert(values, { onConflict: 'code' })

  if (error) throw error
}

export async function deleteCoupon(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('coupons').delete().eq('id', id)
  if (error) throw error
}

export async function toggleCoupon(id: string, isActive: boolean): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('coupons')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/**
 * Validate a coupon server-side. Returns only valid/invalid + discount amount.
 * Never exposes the full coupon object to the client.
 */
export async function validateCoupon(
  code: string,
  subtotal: number
): Promise<CouponValidationResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('validate_coupon', {
    p_code: code,
    p_subtotal: subtotal,
  })

  if (error) throw error
  const row = (data ?? [])[0]
  return {
    valid: row?.valid ?? false,
    discountAmount: row?.discount_amount ?? 0,
    message: row?.message ?? 'Coupon invalide.',
  }
}
