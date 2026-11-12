/**
 * lib/store.ts — Data layer backed by Supabase (PostgreSQL).
 * All product, order, client, and settings operations go through Supabase.
 * The function signatures remain identical to the previous JSON-based version
 * so that pages and server actions keep working without changes.
 */

import { createClient } from '@/lib/supabase/server'
import type { Product } from './data'
import type {
  StoreOrder,
  StoreClient,
  StoreSettings,
  StoreClientAccount,
  AdminAccount,
} from './types/store'

/* ========================================================================
   TYPES (re-exported for convenience)
   ======================================================================== */
export type {
  Product,
  StoreOrder,
  StoreClient,
  StoreSettings,
  StoreClientAccount,
  AdminAccount,
}

/* ========================================================================
   PRODUCTS
   ======================================================================== */

export async function getProducts(): Promise<Product[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Product[]
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) return undefined
  return (data ?? null) as Product | undefined
}

export async function getProductsByCategory(slug: string): Promise<Product[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug_category', slug)
    .order('created_at', { ascending: false })

  if (error) return []
  return (data ?? []) as Product[]
}

export async function getPromoProducts(): Promise<Product[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .not('original_price', 'is', null)
    .order('original_price', { ascending: false })

  if (error) return []
  return (data ?? []) as Product[]
}

/* ========================================================================
   ADMIN CRUD
   ======================================================================== */

export async function upsertProduct(product: Product): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('products').upsert(product, {
    onConflict: 'slug',
  })
  if (error) throw error
}

export async function deleteProduct(slug: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('products').delete().eq('slug', slug)
  if (error) throw error
}

/* ========================================================================
   ORDERS
   ======================================================================== */

export async function getOrders(): Promise<StoreOrder[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return []
  return (data ?? []) as StoreOrder[]
}

export async function getOrdersByClientEmail(email: string): Promise<StoreOrder[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('client_email', email.toLowerCase())
    .order('created_at', { ascending: false })

  if (error) return []
  return (data ?? []) as StoreOrder[]
}

export async function updateOrderStatus(
  id: string,
  status: StoreOrder['status']
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('orders').update({ status }).eq('id', id)
  if (error) throw error
}

export async function createOrder(
  order: Omit<StoreOrder, 'id' | 'createdAt'>
): Promise<StoreOrder> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('orders')
    .insert({
      client_email: order.clientEmail ?? null,
      client_name: order.clientName ?? null,
      customer_name: order.customerName,
      phone: order.phone,
      address: order.address,
      items: order.items,
      total: order.total,
      status: order.status,
      note: order.note ?? null,
    })
    .select()
    .single()

  if (error) throw error

  // Update client stats if email provided
  if (order.clientEmail) {
    await updateClientStats(order.clientEmail, order.total)
  }

  return data as StoreOrder
}

/* ========================================================================
   CLIENTS
   ======================================================================== */

export async function getClients(): Promise<StoreClient[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return []
  return (data ?? []) as StoreClient[]
}

export async function getAllClients(): Promise<StoreClient[]> {
  return getClients()
}

export async function getClientByEmail(email: string): Promise<StoreClient | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('email', email.toLowerCase())
    .single()

  if (error) return null
  return (data ?? null) as StoreClient | null
}

/* ========================================================================
   CLIENT ACCOUNTS (auth)
   ======================================================================== */

export async function createClientAccount(data: {
  email: string
  password: string
  firstName: string
  lastName: string
  phone: string
  address?: string
}): Promise<{ client: StoreClient } | { error: string }> {
  const supabase = createClient()

  // Check if email exists
  const { data: existing } = await supabase
    .from('client_accounts')
    .select('email')
    .eq('email', data.email.toLowerCase())
    .maybeSingle()

  if (existing) return { error: 'Cet email est déjà utilisé.' }

  // Hash password server-side (we use a simple bcrypt via edge function or store hash)
  // Note: password hashing should happen in the action with bcryptjs
  const { data: account, error: accError } = await supabase
    .from('client_accounts')
    .insert({
      email: data.email.toLowerCase(),
      password_hash: data.password, // Will be hashed by the action before calling
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
      address: data.address,
    })
    .select()
    .single()

  if (accError) return { error: accError.message }

  const { data: client, error: cliError } = await supabase
    .from('clients')
    .insert({
      email: data.email.toLowerCase(),
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
      address: data.address,
      order_count: 0,
      total_spent: 0,
    })
    .select()
    .single()

  if (cliError) return { error: cliError.message }

  return { client: client as StoreClient }
}

export async function verifyClientCredentials(
  email: string,
  password: string
): Promise<StoreClient | null> {
  const supabase = createClient()
  const { data: account, error } = await supabase
    .from('client_accounts')
    .select('*')
    .eq('email', email.toLowerCase())
    .single()

  if (error || !account) return null

  // Verify password using bcrypt (imported in action layer)
  const { verifyPassword } = await import('@/lib/utils/crypto')
  const ok = await verifyPassword(password, account.password_hash)
  if (!ok) return null

  return getClientByEmail(email)
}

/* ========================================================================
   ADMIN ACCOUNTS
   ======================================================================== */

export async function verifyAdminCredentials(
  email: string,
  password: string
): Promise<boolean> {
  const supabase = createClient()
  const { data: admin, error } = await supabase
    .from('admin_accounts')
    .select('*')
    .eq('email', email.toLowerCase())
    .single()

  if (error || !admin) return false

  const { verifyPassword } = await import('@/lib/utils/crypto')
  return verifyPassword(password, admin.password_hash)
}

export async function setAdminPassword(
  email: string,
  newPassword: string
): Promise<boolean> {
  const supabase = createClient()
  const { hashPassword } = await import('@/lib/utils/crypto')
  const hash = await hashPassword(newPassword)

  const { error } = await supabase
    .from('admin_accounts')
    .upsert({ email: email.toLowerCase(), password_hash: hash }, {
      onConflict: 'email',
    })
  return !error
}

/* ========================================================================
   SETTINGS
   ======================================================================== */

export async function getSettings(): Promise<StoreSettings> {
  const supabase = createClient()
  const { data, error } = await supabase.from('settings').select('*').single()

  if (error) {
    // Return defaults if table empty
    return {
      storeName: 'SAIS Store',
      whatsappPhone: '212600000000',
      deliveryText: 'Livraison 24–48h partout au Maroc',
      paymentText: 'Paiement à la livraison',
      currency: 'MAD',
    }
  }
  return data as StoreSettings
}

export async function updateSettings(settings: StoreSettings): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('settings')
    .upsert({ ...settings, id: 1 }, { onConflict: 'id' })
  if (error) throw error
}

/* ========================================================================
   HELPERS
   ======================================================================== */

async function updateClientStats(email: string, total: number): Promise<void> {
  const supabase = createClient()
  const { data: client } = await supabase
    .from('clients')
    .select('order_count, total_spent')
    .eq('email', email.toLowerCase())
    .single()

  if (client) {
    await supabase
      .from('clients')
      .update({
        order_count: (client.order_count as number) + 1,
        total_spent: (client.total_spent as number) + total,
      })
      .eq('email', email.toLowerCase())
  }
}

export function invalidateStoreCache() {
  // Supabase handles caching client-side; nothing to invalidate server-side
}
