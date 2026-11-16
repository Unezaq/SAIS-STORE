'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { normalizeMoroccanPhone } from '@/lib/phone'
import { normalizeOrderReference, orderReference } from '@/lib/orderStatus'
import { getAuthenticatedUser } from '@/lib/supabase/auth'
import { getCustomerFromSession } from '@/lib/auth/current-customer'
import {
  createOrder,
  getOrderByToken,
  getOrdersByPhone,
  getProduct,
  getSettings,
  validateCoupon,
} from '@/lib/store'
import { getStorePrice } from '@/lib/pricing'
import type { StoreOrder } from '@/lib/types/store'

/**
 * actions/checkout.ts — the public purchase funnel.
 * Kept apart from actions/admin.ts on purpose: a visitor placing an order is
 * not an administrator, and the checkout never needs an admin session.
 *
 * Prices and totals are ALWAYS computed server-side (in the place_order_rpc
 * PostgreSQL function). The client only sends product_id, variant, quantity
 * and coupon code. Never trusts any price/discount/total from the browser.
 */

const emailSchema = z.email()

const orderItemsSchema = z
  .array(
    z.object({
      slug: z.string().trim().min(1).max(128),
      color: z.string().trim().max(80).optional(),
      size: z.string().trim().max(16).optional(),
      quantity: z.number().int().min(1).max(99),
    })
  )
  .min(1)
  .max(20)

export type PlacedOrderItem = StoreOrder['items'][number] & { imageUrl: string }

export type PlaceOrderResult =
  | {
      ok: true
      orderId: string
      orderNumber: string
      trackingToken: string
      phone: string
      total: number
      discountTotal: number
      items: PlacedOrderItem[]
    }
  | { ok: false; error: string }

export interface TrackedOrder {
  reference: string
  status: StoreOrder['status']
  createdAt: string
  total: number
  subtotal: number
  deliveryFee: number
  discountTotal: number
  customerName: string
  address: string
  phone: string
  note?: string
  items: StoreOrder['items']
}

// ---------------------------------------------------------------------------
// Rate limiting (in-memory, per IP + phone). For production swap for Redis.
// ---------------------------------------------------------------------------
const orderRateLimit = new Map<string, { count: number; resetAt: number }>()
const ORDER_RATE_LIMIT_MAX = 10
const ORDER_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function checkRateLimit(phone: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const entry = orderRateLimit.get(phone)
  if (!entry || now > entry.resetAt) {
    orderRateLimit.set(phone, { count: 1, resetAt: now + ORDER_RATE_LIMIT_WINDOW_MS })
    return { allowed: true }
  }
  if (entry.count >= ORDER_RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: entry.resetAt - now }
  }
  entry.count += 1
  return { allowed: true }
}

function formString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function parseJsonField(value: string): unknown {
  if (!value) return undefined
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export async function placeOrderAction(formData: FormData): Promise<PlaceOrderResult> {
  // Idempotency key: prevents double submission on slow networks / double click
  const idempotencyKey = formString(formData, 'idempotencyKey') || undefined

  // The confirmation checkbox is validated on the server, not only in the UI.
  if (formString(formData, 'confirmInfo') !== 'on') {
    return {
      ok: false,
      error: 'Merci de confirmer que vos informations de livraison sont exactes.',
    }
  }

  const phone = normalizeMoroccanPhone(formString(formData, 'phone'))
  if (!phone) {
    return { ok: false, error: 'Numéro de téléphone marocain invalide.' }
  }

  // Rate limit per phone number
  const rateLimit = checkRateLimit(phone)
  if (!rateLimit.allowed) {
    const retryMin = Math.ceil((rateLimit.retryAfter ?? 0) / 60000)
    return {
      ok: false,
      error: `Trop de commandes récentes. Réessayez dans ${retryMin} minute(s).`,
    }
  }

  const parsed = z
    .object({
      customerName: z.string().trim().min(3).max(160),
      phone: z.string().regex(/^\+212[5-7]\d{8}$/),
      address: z.string().trim().min(10).max(500),
      clientEmail: z.union([emailSchema, z.literal('')]),
      couponCode: z.string().trim().max(64).optional(),
      note: z.string().trim().max(1000),
    })
    .safeParse({
      customerName: formString(formData, 'customerName'),
      phone: phone ?? '',
      address: formString(formData, 'address'),
      clientEmail: formString(formData, 'clientEmail').toLowerCase(),
      couponCode: formString(formData, 'couponCode'),
      note: formString(formData, 'note'),
    })

  if (!parsed.success) {
    return {
      ok: false,
      error:
        'Vérifiez votre nom complet, votre numéro de téléphone marocain et votre adresse de livraison.',
    }
  }

  const items = orderItemsSchema.safeParse(parseJsonField(formString(formData, 'items')))
  if (!items.success) {
    return { ok: false, error: 'Votre panier est vide ou invalide. Rechargez la page et réessayez.' }
  }

  const authenticatedUser = await getAuthenticatedUser()
  const customer = await getCustomerFromSession()
  const [settings, products] = await Promise.all([
    getSettings(),
    Promise.all(items.data.map((item) => getProduct(item.slug))),
  ])

  if (products.some((product) => !product)) {
    return { ok: false, error: 'Un article de votre commande n’est plus disponible.' }
  }

  const invalidVariant = items.data.some((item, index) => {
    const product = products[index]
    if (!product) return true
    return (
      (item.size && product.sizes?.length && !product.sizes.includes(item.size)) ||
      (item.color && product.colors?.length && !product.colors.some((color) => color.name === item.color))
    )
  })
  if (invalidVariant) {
    return { ok: false, error: 'Une taille ou un coloris n’est plus disponible. Vérifiez votre panier.' }
  }

  // Validate coupon server-side if provided
  let couponCode: string | undefined
  let discountTotal = 0
  if (parsed.data.couponCode) {
    const validation = await validateCoupon(parsed.data.couponCode, 0) // subtotal computed in RPC
    if (!validation.valid) {
      return { ok: false, error: validation.message }
    }
    couponCode = parsed.data.couponCode
    discountTotal = validation.discountAmount
  }

  const orderItems: StoreOrder['items'] = []
  const confirmationItems: PlacedOrderItem[] = []
  for (const [index, item] of items.data.entries()) {
    const product = products[index]
    if (!product) {
      return { ok: false, error: 'Un article de votre commande n’est plus disponible.' }
    }
    const confirmedItem = {
      slug: product.slug,
      title: product.title,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      price: getStorePrice(product, settings),
    }
    orderItems.push(confirmedItem)
    confirmationItems.push({ ...confirmedItem, imageUrl: product.imageUrl })
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0)
  const deliveryFee =
    settings.freeDeliveryMinItems > 0 && totalItems >= settings.freeDeliveryMinItems
      ? 0
      : settings.deliveryFee
  const total = subtotal - discountTotal + deliveryFee
  const clientEmail =
    authenticatedUser?.email?.toLowerCase() ||
    customer?.email ||
    parsed.data.clientEmail ||
    undefined

  const order = await createOrder(
    {
      clientEmail,
      clientName: parsed.data.customerName,
      customerName: parsed.data.customerName,
      phone: parsed.data.phone,
      address: parsed.data.address,
      items: orderItems,
      subtotal,
      discountTotal,
      deliveryFee,
      total,
      status: 'en_attente',
      note: parsed.data.note || undefined,
      couponCode,
      paymentMethod: 'cod',
      paymentStatus: 'unpaid',
    },
    authenticatedUser?.id ?? null,
    customer?.id ?? null,
    { couponCode, idempotencyKey }
  )

  revalidatePath('/admin/orders')
  revalidatePath('/admin/clients')
  revalidatePath('/account')

  return {
    ok: true,
    orderId: order.id,
    orderNumber: order.orderNumber ?? orderReference(order.id),
    trackingToken: order.trackingToken ?? '',
    phone: order.phone,
    total: order.total,
    discountTotal: order.discountTotal,
    items: confirmationItems,
  }
}

/**
 * Public tracking: the phone number acts as the secret, the reference points
 * at one order. No account needed, no order list exposed.
 */
export async function trackOrderAction(
  formData: FormData
): Promise<{ ok: true; order: TrackedOrder } | { ok: false; error: string }> {
  const parsed = z
    .object({
      phone: z.string().trim().min(1).max(20),
      reference: z
        .string()
        .trim()
        .max(64)
        .refine((value) => normalizeOrderReference(value).length >= 8),
    })
    .safeParse({
      phone: formString(formData, 'phone'),
      reference: formString(formData, 'reference'),
    })

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Saisissez le téléphone utilisé lors de la commande et sa référence (SAIS-…).',
    }
  }

  const phone = normalizeMoroccanPhone(parsed.data.phone)
  if (!phone) {
    return { ok: false, error: 'Ce numéro de téléphone n’est pas un numéro marocain valide.' }
  }

  const rawReference = parsed.data.reference.trim().toLowerCase()
  const code = normalizeOrderReference(parsed.data.reference)
  const orders = await getOrdersByPhone(phone)
  const order = orders.find(
    (candidate) =>
      candidate.id.toLowerCase() === rawReference ||
      orderReference(candidate.id).slice(-8) === code
  )

  if (!order) {
    return {
      ok: false,
      error: 'Aucune commande ne correspond à ce numéro et à cette référence. Vérifiez-les ou écrivez-nous sur WhatsApp.',
    }
  }

  return {
    ok: true,
    order: {
      reference: orderReference(order.id),
      status: order.status,
      createdAt: order.createdAt,
      total: order.total,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      discountTotal: order.discountTotal,
      customerName: order.customerName,
      address: order.address,
      phone: order.phone,
      note: order.note,
      items: order.items,
    },
  }
}

/**
 * Track an order by its unguessable token (no phone needed).
 */
export async function trackOrderByToken(
  token: string
): Promise<{ ok: true; order: TrackedOrder } | { ok: false; error: string }> {
  const order = await getOrderByToken(token)
  if (!order) {
    return {
      ok: false,
      error: 'Référence de suivi introuvable.',
    }
  }

  return {
    ok: true,
    order: {
      reference: order.orderNumber ?? orderReference(order.id),
      status: order.status,
      createdAt: order.createdAt,
      total: order.total,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      discountTotal: order.discountTotal,
      customerName: order.customerName,
      address: order.address,
      phone: order.phone,
      note: order.note,
      items: order.items,
    },
  }
}
