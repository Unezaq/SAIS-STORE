import { cache } from 'react'
import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { StoreSettings } from '@/lib/types/store'

type SettingsRow = {
  id: number
  store_name: string
  whatsapp_phone: string
  delivery_text: string
  payment_text: string
  currency: string
  delivery_fee: number
  free_delivery_min_items: number
  storewide_discount_percent: number
  discount_start_date: string | null
  discount_end_date: string | null
}

function mapSettings(row: SettingsRow): StoreSettings {
  return {
    storeName: row.store_name,
    whatsappPhone: row.whatsapp_phone,
    deliveryText: row.delivery_text,
    paymentText: row.payment_text,
    currency: row.currency,
    deliveryFee: row.delivery_fee,
    freeDeliveryMinItems: row.free_delivery_min_items,
    storewideDiscountPercent: row.storewide_discount_percent ?? 0,
    discountStartDate: row.discount_start_date ?? undefined,
    discountEndDate: row.discount_end_date ?? undefined,
  }
}

const defaultSettings: StoreSettings = {
  storeName: 'SAIS Store',
  whatsappPhone: '212644816544',
  deliveryText: 'Livraison 24–48h partout au Maroc',
  paymentText: 'Paiement à la livraison',
  currency: 'MAD',
  deliveryFee: 22,
  freeDeliveryMinItems: 3,
  storewideDiscountPercent: 0,
  discountStartDate: undefined,
  discountEndDate: undefined,
}

export const getSettings = cache(async function getSettings(): Promise<StoreSettings> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('settings')
    .select(
      'id, store_name, whatsapp_phone, delivery_text, payment_text, currency, delivery_fee, free_delivery_min_items, storewide_discount_percent, discount_start_date, discount_end_date'
    )
    .eq('id', 1)
    .single()

  if (error) {
    const optionalDiscountColumns = [
      'storewide_discount_percent',
      'discount_start_date',
      'discount_end_date',
    ]
    const missingOptionalDiscountColumn =
      error.code === '42703' &&
      optionalDiscountColumns.some((column) => error.message?.includes(column))

    if (!missingOptionalDiscountColumn) {
      if (!data) return defaultSettings
      throw error
    }

    const fallback = await supabase
      .from('settings')
      .select(
        'id, store_name, whatsapp_phone, delivery_text, payment_text, currency, delivery_fee, free_delivery_min_items'
      )
      .eq('id', 1)
      .single()

    if (fallback.error || !fallback.data) {
      return defaultSettings
    }

    return mapSettings({
      ...(fallback.data as SettingsRow),
      storewide_discount_percent: 0,
      discount_start_date: null,
      discount_end_date: null,
    })
  }

  if (!data) return defaultSettings
  return mapSettings(data as SettingsRow)
})

export async function updateSettings(settings: StoreSettings): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('settings')
    .update({
      store_name: settings.storeName,
      whatsapp_phone: settings.whatsappPhone,
      delivery_text: settings.deliveryText,
      payment_text: settings.paymentText,
      currency: settings.currency,
      delivery_fee: settings.deliveryFee,
      free_delivery_min_items: settings.freeDeliveryMinItems,
      storewide_discount_percent: settings.storewideDiscountPercent,
      discount_start_date: settings.discountStartDate || null,
      discount_end_date: settings.discountEndDate || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)

  if (error) throw error
}
