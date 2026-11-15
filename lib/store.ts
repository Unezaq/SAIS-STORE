import { cache } from 'react'
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { Product } from './data'
import type { StoreClient, StoreOrder, StoreSettings } from './types/store'

type ProductRow = {
  id: string
  title: string
  slug: string
  slug_category: string
  category_name: string
  price: number
  original_price: number | null
  image_url: string
  colors: Product['colors'] | null
  color_images: Product['colorImages'] | null
  sizes: string[] | null
  fabric: string | null
  features: string[] | null
  badge: string | null
  ref: string | null
  description: string | null
}

type OrderRow = {
  id: string
  auth_user_id: string | null
  client_email: string | null
  client_name: string | null
  customer_name: string
  phone: string
  address: string
  items: StoreOrder['items']
  subtotal: number
  delivery_fee: number
  total: number
  status: StoreOrder['status']
  created_at: string
  note: string | null
}

type ClientRow = {
  id: string
  auth_user_id: string | null
  email: string | null
  first_name: string
  last_name: string
  phone: string
  address: string | null
  order_count: number
  total_spent: number
  created_at: string
}

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

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    slugCategory: row.slug_category,
    categoryName: row.category_name,
    price: row.price,
    originalPrice: row.original_price ?? undefined,
    imageUrl: row.image_url,
    colors: row.colors ?? [],
    colorImages: row.color_images ?? undefined,
    sizes: row.sizes ?? [],
    fabric: row.fabric ?? undefined,
    features: row.features ?? [],
    badge: row.badge ?? undefined,
    ref: row.ref ?? undefined,
    description: row.description ?? undefined,
  }
}

function mapOrder(row: OrderRow): StoreOrder {
  return {
    id: row.id,
    clientEmail: row.client_email ?? undefined,
    clientName: row.client_name ?? undefined,
    customerName: row.customer_name,
    phone: row.phone,
    address: row.address,
    items: row.items,
    subtotal: row.subtotal,
    deliveryFee: row.delivery_fee,
    total: row.total,
    status: row.status,
    createdAt: row.created_at,
    note: row.note ?? undefined,
  }
}

function mapClient(row: ClientRow): StoreClient {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    address: row.address ?? undefined,
    orderCount: row.order_count,
    totalSpent: row.total_spent,
    createdAt: row.created_at,
  }
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
    storewideDiscountPercent: row.storewide_discount_percent,
    discountStartDate: row.discount_start_date ?? undefined,
    discountEndDate: row.discount_end_date ?? undefined,
  }
}

function toProductRow(product: Product): ProductRow {
  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    slug_category: product.slugCategory,
    category_name: product.categoryName,
    price: product.price,
    original_price: product.originalPrice ?? null,
    image_url: product.imageUrl,
    colors: product.colors ?? [],
    color_images: product.colorImages ?? {},
    sizes: product.sizes ?? [],
    fabric: product.fabric ?? null,
    features: product.features ?? [],
    badge: product.badge ?? null,
    ref: product.ref ?? null,
    description: product.description ?? null,
  }
}

export const getProducts = cache(async function getProducts(): Promise<Product[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => mapProduct(row as ProductRow))
})

export const getProduct = cache(async function getProduct(slug: string): Promise<Product | undefined> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  return data ? mapProduct(data as ProductRow) : undefined
})

export const getProductsByCategory = cache(async function getProductsByCategory(slug: string): Promise<Product[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug_category', slug)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => mapProduct(row as ProductRow))
})

export const getPromoProducts = cache(async function getPromoProducts(): Promise<Product[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .not('original_price', 'is', null)
    .order('original_price', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => mapProduct(row as ProductRow))
})

export async function upsertProduct(product: Product): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('products').upsert(toProductRow(product), {
    onConflict: 'slug',
  })

  if (error) throw error
}

export async function deleteProduct(slug: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('products').delete().eq('slug', slug)

  if (error) throw error
}

export async function getOrders(): Promise<StoreOrder[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => mapOrder(row as OrderRow))
}

export async function getOrdersByAuthUserId(userId: string): Promise<StoreOrder[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('auth_user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => mapOrder(row as OrderRow))
}

export async function updateOrderStatus(
  id: string,
  status: StoreOrder['status']
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('orders').update({ status }).eq('id', id)

  if (error) throw error
}

export async function createOrder(
  order: Omit<StoreOrder, 'id' | 'createdAt'>,
  authUserId: string | null
): Promise<StoreOrder> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('orders')
    .insert({
      auth_user_id: authUserId,
      client_email: order.clientEmail ?? null,
      client_name: order.clientName ?? null,
      customer_name: order.customerName,
      phone: order.phone,
      address: order.address,
      items: order.items,
      subtotal: order.subtotal,
      delivery_fee: order.deliveryFee,
      total: order.total,
      status: order.status,
      note: order.note ?? null,
    })
    .select('*')
    .single()

  if (error) throw error

  if (authUserId && order.clientEmail) {
    await updateClientStats(supabase, authUserId, order.total)
  }

  return mapOrder(data as OrderRow)
}

export async function getClients(): Promise<StoreClient[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => mapClient(row as ClientRow))
}

export async function getClientByAuthUserId(userId: string): Promise<StoreClient | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data ? mapClient(data as ClientRow) : null
}

export async function ensureClientProfile(profile: {
  authUserId: string
  email: string | null
  firstName: string
  lastName: string
  phone: string
  address?: string
}, options: { allowEmailBasedLinking?: boolean } = {}): Promise<StoreClient> {
  const supabase = createAdminClient()
  const email = profile.email?.trim().toLowerCase() || null

  const { data: linked, error: linkedError } = await supabase
    .from('clients')
    .select('*')
    .eq('auth_user_id', profile.authUserId)
    .maybeSingle()

  if (linkedError) throw linkedError
  let clientRow = linked

  if (!clientRow && email && options.allowEmailBasedLinking) {
    const { data: matches, error: existingError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', email)
      .limit(2)

    if (existingError) throw existingError
    const existingClient = matches?.length === 1 ? matches[0] : null
    if (
      existingClient?.auth_user_id &&
      existingClient.auth_user_id !== profile.authUserId
    ) {
      throw new Error('This customer profile is already linked to another account.')
    }

    const values = {
      auth_user_id: profile.authUserId,
      email,
      first_name: profile.firstName,
      last_name: profile.lastName,
      phone: profile.phone,
      address: profile.address ?? null,
    }
    const query = existingClient
      ? supabase.from('clients').update(values).eq('id', existingClient.id)
      : supabase.from('clients').insert(values)
    const { data, error } = await query.select('*').single()

    if (error) throw error
    clientRow = data
  } else if (!clientRow) {
    const { data, error } = await supabase
      .from('clients')
      .insert({
        auth_user_id: profile.authUserId,
        email,
        first_name: profile.firstName,
        last_name: profile.lastName,
        phone: profile.phone,
        address: profile.address ?? null,
      })
      .select('*')
      .single()

    if (error) throw error
    clientRow = data
  }

  if (options.allowEmailBasedLinking && email) {
    const escapedEmail = email.replace(/[\\%_]/g, '\\$&')
    const { error: ordersError } = await supabase
      .from('orders')
      .update({ auth_user_id: profile.authUserId })
      .is('auth_user_id', null)
      .ilike('client_email', escapedEmail)

    if (ordersError) throw ordersError
  }
  return mapClient(clientRow as ClientRow)
}

export async function updateClientProfileByAuthUserId(profile: {
  authUserId: string
  email: string | null
  firstName: string
  lastName: string
  phone: string
  address: string
}): Promise<void> {
  const client = await ensureClientProfile(profile)
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('clients')
    .update({
      first_name: profile.firstName,
      last_name: profile.lastName,
      phone: profile.phone,
      address: profile.address,
    })
    .eq('id', client.id)
    .eq('auth_user_id', profile.authUserId)
    .select('id')
    .single()

  if (error) throw error
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

  if (error) throw error
  return mapSettings(data as SettingsRow)
})

export async function updateSettings(settings: StoreSettings): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('settings')
    .upsert({
      id: 1,
      store_name: settings.storeName,
      whatsapp_phone: settings.whatsappPhone,
      delivery_text: settings.deliveryText,
      payment_text: settings.paymentText,
      currency: settings.currency,
      delivery_fee: settings.deliveryFee,
      free_delivery_min_items: settings.freeDeliveryMinItems,
      storewide_discount_percent: settings.storewideDiscountPercent,
      discount_start_date: settings.discountStartDate ?? null,
      discount_end_date: settings.discountEndDate ?? null,
    }, { onConflict: 'id' })

  if (error) throw error
}

async function updateClientStats(
  supabase: ReturnType<typeof createAdminClient>,
  authUserId: string,
  total: number
): Promise<void> {
  const { data: client, error: readError } = await supabase
    .from('clients')
    .select('order_count, total_spent')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (readError) throw readError
  if (!client) return

  const { error } = await supabase
    .from('clients')
    .update({
      order_count: client.order_count + 1,
      total_spent: client.total_spent + total,
    })
    .eq('auth_user_id', authUserId)

  if (error) throw error
}

export function invalidateStoreCache() {}
