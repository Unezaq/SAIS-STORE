'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  deleteProduct,
  deleteCoupon,
  toggleCoupon,
  upsertCoupon,
  updateOrderStatus,
  upsertProduct,
  updateSettings,
} from '@/lib/store'
import {
  AUTH_PROVIDERS_DISABLED_MESSAGE,
  isAuthProviderDisabled,
  requireAdmin,
} from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'
import type { StoreSettings } from '@/lib/types/store'

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
const orderStatusSchema = z.enum(['en_attente', 'confirmee', 'expediee', 'livree', 'annulee'])
type ActionResult = { ok: true } | { ok: false; error: string }
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
    if (isAuthProviderDisabled(error.code)) {
      return { ok: false, error: AUTH_PROVIDERS_DISABLED_MESSAGE }
    }
    return { ok: false, error: 'Email ou mot de passe incorrect.' }
  }
  if (data.user?.app_metadata?.role !== 'admin') {
    // Fallback: check profiles table (legacy accounts without app_metadata.role)
    let isAdmin = false
    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()
      isAdmin = profile?.role === 'admin'
    }
    if (!isAdmin) {
      if (data.user) {
        const { error: signOutError } = await supabase.auth.signOut()
        if (signOutError) throw signOutError
      }
      return { ok: false, error: 'Email ou mot de passe incorrect.' }
    }
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
  revalidatePath(`/admin/orders/${parsed.data.id}`)
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

const couponSchema = z.object({
  id: z.string().trim().min(1).max(128).optional(),
  code: z.string().trim().min(3).max(32).toLowerCase(),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().int().min(1).max(1000000),
  minOrder: z.number().int().min(0).max(1000000),
  expiresAt: dateInputSchema.optional(),
  maxUses: z.number().int().min(1).optional(),
  perUserLimit: z.number().int().min(1).optional(),
  isActive: z.boolean().default(true),
})

export async function saveCouponAction(formData: FormData): Promise<ActionResult> {
  await requireAdmin()
  const parsed = couponSchema.safeParse({
    id: formString(formData, 'id') || undefined,
    code: formString(formData, 'code'),
    type: formString(formData, 'type') as 'percentage' | 'fixed',
    value: Number(formString(formData, 'value')),
    minOrder: Number(formString(formData, 'minOrder') || '0'),
    expiresAt: formString(formData, 'expiresAt') || undefined,
    maxUses: formString(formData, 'maxUses')
      ? Number(formString(formData, 'maxUses'))
      : undefined,
    perUserLimit: formString(formData, 'perUserLimit')
      ? Number(formString(formData, 'perUserLimit'))
      : undefined,
    isActive: formString(formData, 'isActive') === 'true',
  })
  if (!parsed.success) return invalidInput()

  await upsertCoupon(parsed.data)
  revalidatePath('/admin/coupons')
  revalidatePath('/')
  return { ok: true }
}

export async function deleteCouponActionAdmin(formData: FormData): Promise<ActionResult> {
  await requireAdmin()
  const parsed = z.object({ id: z.string().trim().min(1).max(128) }).safeParse({
    id: formString(formData, 'id'),
  })
  if (!parsed.success) return invalidInput()

  await deleteCoupon(parsed.data.id)
  revalidatePath('/admin/coupons')
  revalidatePath('/')
  return { ok: true }
}

export async function toggleCouponActionAdmin(formData: FormData): Promise<ActionResult> {
  await requireAdmin()
  const parsed = z
    .object({
      id: z.string().trim().min(1).max(128),
      isActive: z.string().transform((val) => val === 'true'),
    })
    .safeParse({
      id: formString(formData, 'id'),
      isActive: formString(formData, 'isActive'),
    })
  if (!parsed.success) return invalidInput()

  await toggleCoupon(parsed.data.id, parsed.data.isActive)
  revalidatePath('/admin/coupons')
  revalidatePath('/')
  return { ok: true }
}
