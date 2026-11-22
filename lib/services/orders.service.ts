import 'server-only'
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

function mapOrder(row: OrderRow): StoreOrder {
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
    items: row.items ?? [],
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

  const itemsJson = JSON.stringify(
    order.items.map((item) => ({
      slug: item.slug,
      color: item.color ?? null,
      size: item.size ?? null,
      quantity: item.quantity,
    }))
  )

  const { data, error } = await supabase.rpc('place_order_rpc', {
    p_auth_user_id: authUserId,
    p_customer_id: customerId,
    p_client_email: order.clientEmail ?? null,
    p_client_name: order.clientName ?? null,
    p_customer_name: order.customerName,
    p_phone: order.phone,
    p_address: order.address,
    p_city: order.city || 'Casablanca',
    p_items: itemsJson,
    p_note: order.note ?? null,
    p_coupon_code: options.couponCode ?? null,
    p_idempotency_key: options.idempotencyKey ?? null,
  })

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
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => mapOrder(row as OrderRow))
}

export async function getOrderById(id: string): Promise<StoreOrder | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data ? mapOrder(data as OrderRow) : null
}

export async function getOrderByToken(token: string): Promise<StoreOrder | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('tracking_token', token)
    .maybeSingle()

  if (error) throw error
  return data ? mapOrder(data as OrderRow) : null
}

export async function getOrdersByPhone(phone: string): Promise<StoreOrder[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('phone', phone)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => mapOrder(row as OrderRow))
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<void> {
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

export async function getOrderDetail(id: string): Promise<StoreOrder | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const order = mapOrder(data as OrderRow)
  const orderItems = (data as any).order_items ?? []

  return {
    ...order,
    items: orderItems.length > 0
      ? orderItems.map((oi: any) => ({
          slug: oi.product_id,
          title: oi.name_snapshot,
          color: oi.variant ? oi.variant.split(' / ')[0] : undefined,
          size: oi.variant && oi.variant.includes(' / ') ? oi.variant.split(' / ')[1] : undefined,
          quantity: oi.quantity,
          price: Number(oi.unit_price),
        }))
      : order.items,
  }
}
