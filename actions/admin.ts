'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createOrder, deleteProduct, getProduct, getSettings, updateOrderStatus, updateSettings, upsertProduct } from '@/lib/store'
import { getAuthenticatedUser, requireAdmin } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'
import type { StoreOrder, StoreSettings } from '@/lib/types/store'
import { getStorePrice } from '@/lib/pricing'

const emailSchema = z.email()
const imageUrlSchema = z.string().min(1).max(2048).refine(
  (value) => (value.startsWith('/') && !value.startsWith('//')) || value.startsWith('https://'),
  'Image must be a site path or HTTPS URL.'
)
const productColorSchema = z.object({
  name: z.string().trim().min(1).max(80),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
})
const productSchema = z.object({
  id: z.string().trim().min(1).max(128),
  title: z.string().trim().min(1).max(160),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  slugCategory: z.string().trim().min(1).max(64),
  categoryName: z.string().trim().min(1).max(100),
  price: z.number().finite().int().positive().max(100000),
  originalPrice: z.number().finite().int().positive().max(100000).optional(),
  imageUrl: imageUrlSchema,
  colors: z.array(productColorSchema).max(20).optional(),
  colorImages: z.record(z.string(), imageUrlSchema).optional(),
  sizes: z.array(z.string().trim().min(1).max(16)).max(20).optional(),
  fabric: z.string().trim().max(160).optional(),
  features: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
  badge: z.string().trim().max(50).optional(),
  ref: z.string().trim().max(80).optional(),
  description: z.string().trim().max(4000).optional(),
})
const orderItemsSchema = z.array(z.object({
  slug: z.string().trim().min(1).max(128),
  color: z.string().trim().max(80).optional(),
  size: z.string().trim().max(16).optional(),
  quantity: z.number().int().min(1).max(99),
})).min(1).max(20)
const orderStatusSchema = z.enum(['en_attente', 'confirmee', 'expediee', 'livree', 'annulee'])
type ActionResult = { ok: true } | { ok: false; error: string }
type CreateClientOrderResult =
  | {
      ok: true
      orderId: string
      total: number
      items: Array<StoreOrder['items'][number] & { imageUrl: string }>
    }
  | { ok: false; error: string }
const dateInputSchema = z.string().refine((value) => {
  if (!value) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
})

const settingsSchema = z.object({
  storeName: z.string().trim().min(1).max(100),
  whatsappPhone: z.string().regex(/^\d{11,15}$/),
  deliveryText: z.string().trim().min(1).max(2000),
  paymentText: z.string().trim().min(1).max(2000),
  deliveryFee: z.number().int().min(0).max(1000),
  freeDeliveryMinItems: z.number().int().min(0).max(99),
  storewideDiscountPercent: z.number().int().min(0).max(90),
  discountStartDate: dateInputSchema,
  discountEndDate: dateInputSchema,
}).superRefine((settings, context) => {
  if (settings.storewideDiscountPercent > 0) {
    if (!settings.discountStartDate || !settings.discountEndDate) {
      context.addIssue({
        code: 'custom',
        message: 'A start and end date are required for an active storewide promotion.',
        path: ['discountStartDate'],
      })
    } else if (settings.discountEndDate < settings.discountStartDate) {
      context.addIssue({
        code: 'custom',
        message: 'The promotion end date must be on or after the start date.',
        path: ['discountEndDate'],
      })
    }
  }
})

function formString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function invalidInput(): { ok: false; error: string } {
  return { ok: false, error: 'Veuillez vérifier les informations saisies.' }
}

function parseJsonField(value: string): unknown {
  if (!value) return undefined
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function parseColors(value: string): unknown {
  if (!value) return undefined
  if (value.trim().startsWith('[') || value.trim().startsWith('{')) {
    return parseJsonField(value)
  }
  return value.split(',').map((name) => ({ name: name.trim(), hex: '#CCCCCC' })).filter((color) => color.name)
}

export async function loginAction(formData: FormData) {
  const credentials = z.object({ email: emailSchema, password: z.string().min(1).max(256) }).safeParse({
    email: formString(formData, 'email').toLowerCase(),
    password: formString(formData, 'password'),
  })
  if (!credentials.success) return invalidInput()

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(credentials.data)
  if (error) {
    return { ok: false, error: 'Email ou mot de passe incorrect.' }
  }
  if (data.user?.app_metadata?.role !== 'admin') {
    if (data.user) {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
    }
    return { ok: false, error: 'Email ou mot de passe incorrect.' }
  }

  return { ok: true }
}

export async function logoutAction() {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  redirect('/admin/login')
}

export async function saveProductAction(formData: FormData): Promise<ActionResult> {
  await requireAdmin()
  const rawColors = parseColors(formString(formData, 'colors'))
  const rawColorImages = parseJsonField(formString(formData, 'colorImages'))
  const parsed = productSchema.safeParse({
    id: formString(formData, 'id') || `p-${randomUUID()}`,
    title: formString(formData, 'title'),
    slug: formString(formData, 'slug'),
    slugCategory: formString(formData, 'slugCategory'),
    categoryName: formString(formData, 'categoryName'),
    price: Number(formString(formData, 'price')),
    originalPrice: formString(formData, 'originalPrice')
      ? Number(formString(formData, 'originalPrice'))
      : undefined,
    imageUrl: formString(formData, 'imageUrl'),
    colors: rawColors,
    colorImages: rawColorImages,
    sizes: formString(formData, 'sizes').split(',').map((size) => size.trim()).filter(Boolean),
    fabric: formString(formData, 'fabric'),
    features: formString(formData, 'features').split('\n').map((feature) => feature.trim()).filter(Boolean),
    badge: formString(formData, 'badge'),
    ref: formString(formData, 'ref'),
    description: formString(formData, 'description'),
  })
  if (!parsed.success) return invalidInput()

  await upsertProduct(parsed.data)
  revalidatePath('/admin/products')
  revalidatePath('/boutique')
  revalidatePath('/')
  return { ok: true }
}

export async function deleteProductAction(formData: FormData): Promise<ActionResult> {
  await requireAdmin()
  const parsed = z.object({ slug: z.string().trim().min(1).max(128) }).safeParse({
    slug: formString(formData, 'slug'),
  })
  if (!parsed.success) return invalidInput()

  await deleteProduct(parsed.data.slug)
  revalidatePath('/admin/products')
  revalidatePath('/boutique')
  revalidatePath('/')
  return { ok: true }
}

export async function updateOrderStatusAction(formData: FormData): Promise<ActionResult> {
  await requireAdmin()
  const parsed = z.object({
    id: z.string().trim().min(1).max(128),
    status: orderStatusSchema,
  }).safeParse({
    id: formString(formData, 'id'),
    status: formString(formData, 'status'),
  })
  if (!parsed.success) return invalidInput()

  await updateOrderStatus(parsed.data.id, parsed.data.status)
  revalidatePath('/admin/orders')
  return { ok: true }
}

export async function saveSettingsAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin()
  const parsed = settingsSchema.safeParse({
    storeName: formString(formData, 'storeName'),
    whatsappPhone: formString(formData, 'whatsappPhone'),
    deliveryText: formString(formData, 'deliveryText'),
    paymentText: formString(formData, 'paymentText'),
    deliveryFee: Number(formString(formData, 'deliveryFee')),
    freeDeliveryMinItems: Number(formString(formData, 'freeDeliveryMinItems')),
    storewideDiscountPercent: Number(formString(formData, 'storewideDiscountPercent')),
    discountStartDate: formString(formData, 'discountStartDate'),
    discountEndDate: formString(formData, 'discountEndDate'),
  })
  if (!parsed.success) return { ok: false, error: 'Vérifiez les frais, seuil et dates de promotion.' }

  const settings: StoreSettings = {
    ...parsed.data,
    discountStartDate: parsed.data.discountStartDate || undefined,
    discountEndDate: parsed.data.discountEndDate || undefined,
    currency: 'MAD',
  }
  await updateSettings(settings)
  revalidatePath('/', 'layout')
  revalidatePath('/admin/settings')
  return { ok: true }
}

export async function createClientOrderAction(
  formData: FormData
): Promise<CreateClientOrderResult> {
  const parsed = z.object({
    customerName: z.string().trim().min(1).max(160),
    phone: z.string().trim().regex(/^\+?[\d\s()-]{9,18}$/),
    address: z.string().trim().min(1).max(500),
    clientEmail: emailSchema.optional(),
    note: z.string().trim().max(1000).optional(),
  }).safeParse({
    customerName: formString(formData, 'customerName'),
    phone: formString(formData, 'phone'),
    address: formString(formData, 'address'),
    clientEmail: formString(formData, 'clientEmail') || undefined,
    note: formString(formData, 'note') || undefined,
  })
  if (!parsed.success) return invalidInput()

  const rawItems = parseJsonField(formString(formData, 'items'))
  const items = orderItemsSchema.safeParse(rawItems)
  if (!items.success) return invalidInput()

  const authenticatedUser = await getAuthenticatedUser()
  const [settings, products] = await Promise.all([
    getSettings(),
    Promise.all(items.data.map((item) => getProduct(item.slug))),
  ])
  if (products.some((product) => !product)) {
    return { ok: false, error: 'Un produit de cette commande n’est plus disponible.' }
  }

  const invalidVariant = items.data.some((item, index) => {
    const product = products[index]
    if (!product) return true
    return (
      (item.size && product.sizes?.length && !product.sizes.includes(item.size)) ||
      (item.color && product.colors?.length && !product.colors.some((color) => color.name === item.color))
    )
  })
  if (invalidVariant) return invalidInput()

  const orderItems: StoreOrder['items'] = []
  const confirmationItems: Array<StoreOrder['items'][number] & { imageUrl: string }> = []
  for (const [index, item] of items.data.entries()) {
    const product = products[index]
    if (!product) return invalidInput()
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
  const total = subtotal + deliveryFee
  const clientEmail = authenticatedUser?.email?.toLowerCase() ?? parsed.data.clientEmail

  const order = await createOrder({
    clientEmail,
    clientName: parsed.data.customerName,
    customerName: parsed.data.customerName,
    phone: parsed.data.phone,
    address: parsed.data.address,
    items: orderItems,
    subtotal,
    deliveryFee,
    total,
    status: 'en_attente',
    note: parsed.data.note,
  }, authenticatedUser?.id ?? null)

  revalidatePath('/admin/orders')
  revalidatePath('/admin/clients')
  revalidatePath('/account')
  return { ok: true, orderId: order.id, total: order.total, items: confirmationItems }
}
