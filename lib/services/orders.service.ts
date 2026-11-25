import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { orderReference } from '@/lib/orderStatus'
import type { OrderStatus } from '@/lib/orderStatus'
import type { StoreOrder } from '@/lib/types/store'

type OrderRow = {
  id: string
  order_number: string
  tracking_token: string
  idempotency_key?: string | null
  customer_name: string
  phone: string
  city: string
  address: string
  client_email?: string | null
  client_name?: string | null
  items: StoreOrder['items']
  subtotal: number
  discount_total: number
  delivery_fee: number
  total: number
  status: OrderStatus
  payment_method: string
  payment_status: string
  note?: string | null
  created_at: string
  updated_at: string
}

function upperRight8(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-8)
}

type OrderItemRow = {
  product_id: string
  name_snapshot: string
  variant?: string | null
  unit_price: number | string
  quantity: number
  products?: { slug?: string | null } | null
}

/**
 * The orders.items JSON snapshot only carries slug/color/size/quantity. The
 * readable line items (title, unit price) live in order_items, so every read
 * enriches the order from that table. Without this, admin and confirmation
 * pages printed `undefined` and `NaN MAD`.
 */
function mapJoinedItems(
  rawItems: unknown,
  fallback: StoreOrder['items']
): StoreOrder['items'] {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return fallback

  return rawItems.map((raw) => {
    const item = raw as OrderItemRow
    const [color, size] = (item.variant ?? '').split(' / ')

    return {
      slug: item.products?.slug ?? item.product_id,
      title: item.name_snapshot,
      color: color || undefined,
      size: size || undefined,
      quantity: Number(item.quantity),
      price: Number(item.unit_price),
    }
  })
}

function mapOrder(row: OrderRow, items?: StoreOrder['items']): StoreOrder {
  return {
    id: row.id,
    orderNumber: row.order_number || ('SAIS-' + upperRight8(row.id)),
    trackingToken: row.tracking_token,
    clientEmail: row.client_email ?? undefined,
    clientName: row.client_name ?? undefined,
    customerName: row.customer_name,
    phone: row.phone,
    city: row.city || 'Casablanca',
    address: row.address,
    items: items ?? row.items ?? [],
    subtotal: Number(row.subtotal),
    discountTotal: Number(row.discount_total ?? 0),
    deliveryFee: Number(row.delivery_fee),
    total: Number(row.total),
    couponCode: undefined,
    paymentMethod: row.payment_method || 'cod',
    paymentStatus: row.payment_status || 'unpaid',
    status: row.status,
    createdAt: row.created_at,
    note: row.note ?? undefined,
  }
}

export async function createOrder(
  order: Omit<StoreOrder, 'id' | 'createdAt'>,
  authUserId: string | null = null,
  customerId: string | null = null,
  options: { couponCode?: string; idempotencyKey?: string } = {}
): Promise<StoreOrder> {
  const supabase = createAdminClient()

  const items = order.items.map((item) => ({
    slug: item.slug,
    color: item.color ?? null,
    size: item.size ?? null,
    quantity: item.quantity,
  }))

  const rpcArgs = {
    p_auth_user_id: authUserId,
    p_customer_id: customerId,
    p_client_email: order.clientEmail ?? null,
    p_client_name: order.clientName ?? null,
    p_customer_name: order.customerName,
    p_phone: order.phone,
    p_address: order.address,
    p_city: order.city || 'Casablanca',
    p_items: items,
    p_note: order.note ?? null,
    p_coupon_code: options.couponCode ?? null,
    p_idempotency_key: options.idempotencyKey ?? null,
  }

  let { data, error } = await supabase.rpc('place_order_rpc', rpcArgs)

  /**
   * 42702 = ambiguous column inside place_order_rpc's idempotency lookup. The
   * order itself is valid, so retry once without the key instead of failing the
   * sale. Permanent fix: migration 20261123_fix_place_order_rpc_idempotency.sql.
   */
  if (error?.code === '42702' && options.idempotencyKey) {
    console.warn(
      '[orders] place_order_rpc rejected the idempotency clause; retrying without a key. Apply migration 20261123_fix_place_order_rpc_idempotency.sql.'
    )
    const retry = await supabase.rpc('place_order_rpc', {
      ...rpcArgs,
      p_idempotency_key: null,
    })
    data = retry.data
    error = retry.error
  }

  if (error) throw error

  const row = (data ?? [])[0]
  if (!row) throw new Error('Order creation returned no row.')

  return {
    id: row.order_id,
    orderNumber: row.order_number,
    trackingToken: row.tracking_token,
    clientEmail: order.clientEmail ?? undefined,
    clientName: order.clientName ?? undefined,
    customerName: order.customerName,
    phone: order.phone,
    city: order.city || 'Casablanca',
    address: order.address,
    items: order.items,
    subtotal: Number(row.subtotal),
    discountTotal: Number(row.discount_total),
    deliveryFee: Number(row.delivery_fee),
    total: Number(row.total),
    couponCode: options.couponCode ?? undefined,
    paymentMethod: 'cod',
    paymentStatus: 'unpaid',
    status: row.status as OrderStatus,
    createdAt: new Date().toISOString(),
    note: order.note ?? undefined,
  }
}

export async function getOrders(): Promise<StoreOrder[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*, products(slug))')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) =>
    mapOrder(row as OrderRow, mapJoinedItems((row as any).order_items, (row as OrderRow).items ?? []))
  )
}

export async function getOrderById(id: string): Promise<StoreOrder | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*, products(slug))')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data
    ? mapOrder(
        data as OrderRow,
        mapJoinedItems((data as any).order_items, (data as OrderRow).items ?? [])
      )
    : null
}

export async function getOrderByToken(token: string): Promise<StoreOrder | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*, products(slug))')
    .eq('tracking_token', token)
    .maybeSingle()

  if (error) throw error
  return data
    ? mapOrder(
        data as OrderRow,
        mapJoinedItems((data as any).order_items, (data as OrderRow).items ?? [])
      )
    : null
}

export async function getOrdersByPhone(phone: string): Promise<StoreOrder[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*, products(slug))')
    .eq('phone', phone)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) =>
    mapOrder(row as OrderRow, mapJoinedItems((row as any).order_items, (row as OrderRow).items ?? []))
  )
}

/**
 * Orders for an authenticated user (RLS-isolated: only their own rows are
 * visible). Used by the customer account order history.
 */
export async function getOrdersByUserId(userId: string): Promise<StoreOrder[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*, products(slug))')
    .eq('auth_user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row: any) =>
    mapOrder(row as OrderRow, mapJoinedItems(row.order_items, (row as OrderRow).items ?? []))
  )
}

/**
 * Public order tracking by phone + exact reference (order_number or
 * tracking_token). Used by guest tracking — no session required. Only the
 * single matching order is returned; no order list is ever exposed.
 */
export async function getOrderForTracking(
  phone: string,
  reference: string
): Promise<StoreOrder | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('get_order_for_tracking', {
    p_order_number: reference,
    p_phone: phone,
  })

  if (error) throw error
  const row = (data ?? [])[0]
  if (!row) return null

  return mapOrder(row as unknown as OrderRow, mapJoinedItems(row.items, []))
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  actorId: string | null = null,
  actorType: 'admin' | 'customer' = 'admin'
): Promise<void> {
  // Cancellation and return go through dedicated SECURITY DEFINER RPCs that
  // handle stock, coupons, ledger, and idempotency. They run with the real
  // user session so auth.uid()/is_admin() can authorize the action.
  if (status === 'annulee' || status === 'returned') {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    const sessionUserId = data.user?.id

    if (!sessionUserId) {
      throw new Error('Session administrateur requise pour cette opération.')
    }

    if (status === 'annulee') {
      const { error } = await supabase.rpc('cancel_order_rpc', {
        p_order_id: id,
        p_actor_id: sessionUserId,
        p_actor_type: actorType,
        p_idempotency_key: `cancel:${id}`,
        p_note: 'Statut mis à jour vers annulée.',
      })
      if (error) throw error
      return
    }

    const { error } = await supabase.rpc('return_order_rpc', {
      p_order_id: id,
      p_actor_id: sessionUserId,
      p_return_items: [],
      p_idempotency_key: `return:${id}`,
      p_note: 'Statut mis à jour vers retournée.',
    })
    if (error) throw error
    return
  }

  const supabase = createAdminClient()
  const { error: updateError } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (updateError) throw updateError

  try {
    await supabase.from('order_status_history').insert({
      order_id: id,
      status,
      note: `Statut mis à jour vers : ${status}`,
    })
  } catch {
    // Non-blocking status history audit insert
  }
}

/**
 * Cancel an order (customer or admin). Restores stock exactly once,
 * reverses coupon usage, writes ledger entries. Idempotent.
 *
 * The RPC derives the actor from the authenticated session; a caller-supplied
 * actor id can never override auth.uid().
 */
export async function cancelOrder(
  orderId: string,
  actorId: string | null,
  actorType: 'admin' | 'customer' = 'customer',
  idempotencyKey?: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const sessionUserId = data.user?.id

  if (!sessionUserId) {
    return { ok: false, error: 'Vous devez être connecté(e) pour annuler cette commande.' }
  }

  const { error } = await supabase.rpc('cancel_order_rpc', {
    p_order_id: orderId,
    p_actor_id: sessionUserId,
    p_actor_type: actorType,
    p_idempotency_key: idempotencyKey ?? `cancel:${orderId}`,
    p_note: 'Annulation demandée.',
  })

  if (error) {
    return { ok: false, error: error.message ?? 'Annulation échouée.' }
  }

  return { ok: true }
}

/**
 * Return an order after delivery (admin only). Restocks returned quantities.
 * Idempotent.
 *
 * An empty `returnItems` means "return every line": the RPC derives the
 * quantities and variants from the immutable order_items rows.
 */
export async function returnOrder(
  orderId: string,
  actorId: string | null,
  returnItems: Array<{ product_id?: string; variant_id?: string; quantity: number }>,
  idempotencyKey?: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const sessionUserId = data.user?.id

  if (!sessionUserId) {
    return { ok: false, error: 'Session administrateur requise pour enregistrer un retour.' }
  }

  const { error } = await supabase.rpc('return_order_rpc', {
    p_order_id: orderId,
    p_actor_id: sessionUserId,
    p_return_items: returnItems,
    p_idempotency_key: idempotencyKey ?? `return:${orderId}`,
    p_note: 'Retour enregistré.',
  })

  if (error) {
    return { ok: false, error: error.message ?? 'Retour échoué.' }
  }

  return { ok: true }
}

export async function getOrderDetail(id: string): Promise<StoreOrder | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*, products(slug))')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return mapOrder(
    data as OrderRow,
    mapJoinedItems((data as any).order_items, (data as OrderRow).items ?? [])
  )
}
