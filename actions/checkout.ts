'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { rememberDeliveryAddress } from '@/actions/customer-account'
import { normalizeMoroccanPhone } from '@/lib/phone'
import { normalizeOrderReference, orderReference } from '@/lib/orderStatus'
import {
  createOrder,
  getOrderByToken,
  getOrderForTracking,
  getProduct,
  getSettings,
  validateCoupon,
} from '@/lib/store'
import { getStorePrice } from '@/lib/pricing'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { getAuthenticatedUser } from '@/lib/security/auth'
import type { StoreOrder } from '@/lib/types/store'

/**
 * actions/checkout.ts — the public purchase funnel.
 * Kept apart from actions/admin.ts on purpose: a visitor placing an order is
 * not an administrator, and the checkout never needs an admin session.
 *
 * Prices and totals are ALWAYS computed server-side (in the place_order_rpc
 * PostgreSQL function). The client only sends product_id, variant, quantity
 * and coupon code. Never trusts any price/discount/total from the browser.
 *
 * Guest-first: no auth.uid(), no Supabase user session required. Customer
 * details are stored directly on the orders table. When the buyer happens to
 * be signed in, the delivery address is also remembered in their account
 * (best-effort) so their next checkout is pre-filled.
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

const ORDER_RATE_LIMIT_OPTIONS = { max: 10, windowMs: 60 * 60 * 1000 } // 1 hour
const TRACK_RATE_LIMIT_OPTIONS = { max: 20, windowMs: 10 * 60 * 1000 } // 10 minutes
// The tracking token is 128-bit, so this limit is abuse protection, not the
// security boundary: it stops a single client from hammering the RPC.
const TOKEN_TRACK_RATE_LIMIT_OPTIONS = { max: 120, windowMs: 10 * 60 * 1000 }
const COUPON_CHECK_RATE_LIMIT_OPTIONS = { max: 30, windowMs: 10 * 60 * 1000 }

/**
 * Best-effort client identity for IP-scoped limits. `headers()` is only
 * available inside a request scope; when it is not (tests, background work)
 * all callers share one bucket, which still bounds abuse.
 */
async function clientRateLimitKey(scope: string): Promise<string> {
  try {
    const requestHeaders = await headers()
    // Prefer x-real-ip (typically set by a trusted reverse proxy/load balancer)
    // over x-forwarded-for (which is client-controllable and easily spoofed).
    // In production behind a trusted proxy, the proxy should strip or replace
    // untrusted forwarded headers. This IP-based limit is supplementary to
    // the phone-based limits, not the primary control.
    const realIp = requestHeaders.get('x-real-ip')?.trim()
    const forwarded = requestHeaders.get('x-forwarded-for') ?? ''
    const ip = realIp || forwarded.split(',')[0]?.trim()
    return `${scope}:${ip || 'unknown'}`
  } catch {
    return `${scope}:unknown`
  }
}

function formString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Turns a Supabase/PostgREST failure into something the customer can act on.
 * The RPC raises readable French messages (stock, variant, coupon), so those
 * are forwarded as-is instead of being replaced by a generic "impossible".
 */
function describeOrderError(error: unknown): string {
  const failure = error as { code?: string; message?: string; details?: string } | null
  const message = typeof failure?.message === 'string' ? failure.message : ''

  if (message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
    console.error(
      '[checkout] SUPABASE_SERVICE_ROLE_KEY is missing on this deployment: orders cannot be written.'
    )
    return 'La commande ne peut pas être enregistrée pour le moment (configuration serveur incomplète). Écrivez-nous sur WhatsApp : nous la prenons en note tout de suite.'
  }

  // Only the RPC's own business messages (raise exception → P0001) are shown;
  // technical/PostgREST messages stay in the server log.
  if (failure?.code === 'P0001' && message && message.length <= 300) {
    return message
  }

  return 'La commande n’a pas pu être enregistrée. Vérifiez votre connexion et réessayez, ou écrivez-nous sur WhatsApp.'
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
  // Orders sent from the WhatsApp button are tagged so the admin sees them.
  const channel = formString(formData, 'channel') === 'whatsapp' ? 'whatsapp' : 'site'

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
  const rateLimit = await checkRateLimit(`order:${phone}`, ORDER_RATE_LIMIT_OPTIONS)
  if (!rateLimit.allowed) {
    const retryMin = Math.ceil((rateLimit.retryAfter ?? 0) / 60000)
    return {
      ok: false,
      error: `Trop de commandes récentes. Réessayez dans ${retryMin} minute(s).`,
    }
  }

  // Defense-in-depth: IP-based limit to slow phone-rotation bypass attempts.
  // Phone-based limit is the primary control; IP limit is supplementary
  // because forwarded IP headers are not fully trusted (see clientRateLimitKey).
  const ipRateLimit = await checkRateLimit(
    await clientRateLimitKey('order-ip'),
    { max: 20, windowMs: 60 * 60 * 1000 }
  )
  if (!ipRateLimit.allowed) {
    const retryMin = Math.ceil((ipRateLimit.retryAfter ?? 0) / 60000)
    return {
      ok: false,
      error: `Trop de commandes récentes. Réessayez dans ${retryMin} minute(s).`,
    }
  }

  const parsed = z
    .object({
      customerName: z.string().trim().min(3).max(160),
      phone: z.string().regex(/^\+212[5-7]\d{8}$/),
      city: z.string().trim().min(1).max(100),
      address: z.string().trim().min(10).max(500),
      clientEmail: z.union([emailSchema, z.literal('')]),
      couponCode: z.string().trim().max(64).optional(),
      note: z.string().trim().max(1000),
    })
    .safeParse({
      customerName: formString(formData, 'customerName'),
      phone: phone ?? '',
      city: formString(formData, 'city'),
      address: formString(formData, 'address'),
      clientEmail: formString(formData, 'clientEmail').toLowerCase(),
      couponCode: formString(formData, 'couponCode'),
      note: formString(formData, 'note'),
    })

  if (!parsed.success) {
    return {
      ok: false,
      error:
        'Vérifiez votre nom complet, votre ville, votre numéro de téléphone marocain et votre adresse de livraison.',
    }
  }

  const items = orderItemsSchema.safeParse(parseJsonField(formString(formData, 'items')))
  if (!items.success) {
    return { ok: false, error: 'Votre panier est vide ou invalide. Rechargez la page et réessayez.' }
  }

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

  // Validate the coupon against the real basket subtotal: a code with a
  // minimum order amount must be accepted when the basket qualifies. The RPC
  // revalidates authoritatively before writing the order.
  let couponCode: string | undefined
  let discountTotal = 0
  if (parsed.data.couponCode) {
    const validation = await validateCoupon(parsed.data.couponCode, subtotal)
    if (!validation.valid) {
      return { ok: false, error: validation.message }
    }
    couponCode = parsed.data.couponCode
    discountTotal = validation.discountAmount
  }

  const deliveryFee =
    settings.freeDeliveryMinItems > 0 && totalItems >= settings.freeDeliveryMinItems
      ? 0
      : settings.deliveryFee
  const total = subtotal - discountTotal + deliveryFee

  const note = [
    channel === 'whatsapp' ? '[WhatsApp]' : '',
    parsed.data.note,
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 1000)

  try {
    // Link the order to the authenticated customer when signed in, so they
    // can later claim/view it via their account (RLS-isolated). Guests pass
    // null and the order remains claimable via its tracking token.
    const currentUser = await getAuthenticatedUser()
    const authUserId = currentUser?.id ?? null

    const order = await createOrder(
      {
        clientEmail: parsed.data.clientEmail || undefined,
        clientName: parsed.data.customerName,
        customerName: parsed.data.customerName,
        city: parsed.data.city,
        phone: parsed.data.phone,
        address: parsed.data.address,
        items: orderItems,
        subtotal,
        discountTotal,
        deliveryFee,
        total,
        status: 'en_attente',
        note: note || undefined,
        couponCode,
        paymentMethod: 'cod',
        paymentStatus: 'unpaid',
      },
      authUserId,
      null,
      { couponCode, idempotencyKey }
    )

    revalidatePath('/admin/orders')
    revalidatePath('/admin/clients')

    // Signed-in customer: keep the delivery address used for this order in
    // their account so the next checkout is pre-filled. Never fails the order.
    await rememberDeliveryAddress({
      addressId: formString(formData, 'addressId') || undefined,
      customerName: parsed.data.customerName,
      phone: parsed.data.phone,
      city: parsed.data.city,
      address: parsed.data.address,
    })

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
  } catch (error) {
    const failure = error as { code?: string; message?: string; details?: string; hint?: string }
    console.error('[checkout] placeOrderAction failed', {
      channel,
      phone: parsed.data.phone,
      items: items.data,
      code: failure?.code ?? null,
      message: failure?.message ?? String(error),
      details: failure?.details ?? null,
      hint: failure?.hint ?? null,
    })
    return { ok: false, error: describeOrderError(error) }
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

  // Rate limit tracking attempts per phone number
  const rateLimit = await checkRateLimit(`track:${phone}`, TRACK_RATE_LIMIT_OPTIONS)
  if (!rateLimit.allowed) {
    const retryMin = Math.ceil((rateLimit.retryAfter ?? 0) / 60000)
    return {
      ok: false,
      error: `Trop de tentatives de suivi. Réessayez dans ${retryMin} minute(s).`,
    }
  }

  const order = await getOrderForTracking(phone, parsed.data.reference)

  if (!order) {
    return {
      ok: false,
      error: 'Aucune commande ne correspond à ce numéro et à cette référence. Vérifiez-les ou écrivez-nous sur WhatsApp.',
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

/**
 * Track an order by its unguessable token (no phone needed).
 */
export async function trackOrderByToken(
  token: string
): Promise<{ ok: true; order: TrackedOrder } | { ok: false; error: string }> {
  const rateLimit = await checkRateLimit(
    await clientRateLimitKey('track-token'),
    TOKEN_TRACK_RATE_LIMIT_OPTIONS
  )
  if (!rateLimit.allowed) {
    const retryMin = Math.ceil((rateLimit.retryAfter ?? 0) / 60000)
    return {
      ok: false,
      error: `Trop de tentatives de suivi. Réessayez dans ${retryMin} minute(s).`,
    }
  }

  if (typeof token !== 'string' || token.trim().length < 16 || token.length > 128) {
    return { ok: false, error: 'Référence de suivi introuvable.' }
  }

  const order = await getOrderByToken(token.trim())
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

/**
 * Validates a coupon code against a subtotal for live checkout feedback.
 */
export async function validateCouponAction(
  code: string,
  subtotal: number
): Promise<{ ok: boolean; discountAmount: number; message: string }> {
  const trimmed = typeof code === 'string' ? code.trim() : ''
  if (!trimmed) {
    return { ok: false, discountAmount: 0, message: 'Code promo requis.' }
  }
  if (typeof subtotal !== 'number' || subtotal <= 0) {
    return { ok: false, discountAmount: 0, message: 'Sous-total invalide.' }
  }

  // Coupon codes are short: rate limit guessing so the pre-check cannot be
  // used to enumerate valid codes.
  const rateLimit = await checkRateLimit(
    await clientRateLimitKey('coupon-check'),
    COUPON_CHECK_RATE_LIMIT_OPTIONS
  )
  if (!rateLimit.allowed) {
    const retryMin = Math.ceil((rateLimit.retryAfter ?? 0) / 60000)
    return {
      ok: false,
      discountAmount: 0,
      message: `Trop de vérifications de code promo. Réessayez dans ${retryMin} minute(s).`,
    }
  }

  try {
    const result = await validateCoupon(trimmed, subtotal)
    return {
      ok: result.valid,
      discountAmount: result.discountAmount,
      message: result.message,
    }
  } catch {
    return {
      ok: false,
      discountAmount: 0,
      message: 'Impossible de vérifier le code promo pour le moment.',
    }
  }
}
