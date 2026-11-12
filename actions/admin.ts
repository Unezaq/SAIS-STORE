'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  verifyAdminCredentials,
  setAdminPassword,
  verifyClientCredentials,
  createClientAccount,
  upsertProduct,
  deleteProduct,
  updateOrderStatus,
  updateSettings,
  createOrder,
  hashPassword,
} from '@/lib/products'
import { revalidatePath } from 'next/cache'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@saisstore.ma'
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Sais2026!Secure'

/* ========================================================================
   ADMIN — email + password fort (Supabase)
   ======================================================================== */

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  // S'assurer que l'admin par défaut existe
  try {
    await setAdminPassword(ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD)
  } catch {
    // ignore — si l'admin existe déjà, upsert ne fait rien de mal
  }

  const ok = await verifyAdminCredentials(email, password)
  if (!ok) {
    return { ok: false, error: 'Email ou mot de passe incorrect.' }
  }

  const jar = await cookies()
  jar.set('sais_admin', '1', { httpOnly: true, sameSite: 'lax', path: '/' })
  return { ok: true }
}

export async function logoutAction() {
  const jar = await cookies()
  jar.delete('sais_admin')
  redirect('/admin/login')
}

export async function saveAdminPasswordAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  if (password.length < 8) {
    return { ok: false, error: 'Le mot de passe doit contenir au moins 8 caractères.' }
  }
  const ok = await setAdminPassword(email, password)
  if (!ok) return { ok: false, error: 'Admin introuvable.' }
  revalidatePath('/admin/settings')
  return { ok: true }
}

/* ========================================================================
   PRODUITS
   ======================================================================== */

export async function saveProductAction(formData: FormData) {
  'use server'
  const { revalidatePath } = await import('next/cache')

  const slug = String(formData.get('slug') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  const price = Number(formData.get('price') ?? 0)
  const imageUrl = String(formData.get('imageUrl') ?? '').trim()

  if (!title || !slug || !imageUrl) {
    return { ok: false, error: 'Titre, slug et image sont obligatoires.' }
  }

  const colorsRaw = String(formData.get('colors') ?? '').trim()
  let colors: Array<{ name: string; hex: string }> | undefined
  try {
    if (colorsRaw) colors = JSON.parse(colorsRaw)
  } catch {
    colors = colorsRaw.split(',').map((n) => ({ name: n.trim(), hex: '#CCCCCC' })).filter((c) => c.name)
  }

  const product = {
    id: String(formData.get('id') ?? `p-${Date.now()}`),
    title,
    slug,
    slugCategory: String(formData.get('slugCategory') ?? 'ensembles'),
    categoryName: String(formData.get('categoryName') ?? 'Ensembles Hiver'),
    price,
    originalPrice: formData.get('originalPrice') ? Number(formData.get('originalPrice')) : undefined,
    imageUrl,
    colors,
    colorImages: formData.get('colorImages') ? JSON.parse(String(formData.get('colorImages'))) : undefined,
    sizes: formData.get('sizes') ? String(formData.get('sizes')).split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    fabric: String(formData.get('fabric') ?? '').trim() || undefined,
    features: formData.get('features') ? String(formData.get('features')).split('\n').map((s) => s.trim()).filter(Boolean) : undefined,
    badge: String(formData.get('badge') ?? '').trim() || undefined,
    ref: String(formData.get('ref') ?? '').trim() || undefined,
    description: String(formData.get('description') ?? '').trim() || undefined,
  }

  await upsertProduct(product as any)
  revalidatePath('/admin/products')
  revalidatePath('/boutique')
  revalidatePath('/')
  return { ok: true }
}

export async function deleteProductAction(formData: FormData) {
  'use server'
  const { revalidatePath } = await import('next/cache')
  await deleteProduct(String(formData.get('slug')))
  revalidatePath('/admin/products')
  revalidatePath('/boutique')
  revalidatePath('/')
  return { ok: true }
}

export async function updateOrderStatusAction(formData: FormData) {
  'use server'
  const { revalidatePath } = await import('next/cache')
  await updateOrderStatus(String(formData.get('id')), String(formData.get('status')) as any)
  revalidatePath('/admin/orders')
  return { ok: true }
}

export async function saveSettingsAction(formData: FormData) {
  'use server'
  const { revalidatePath } = await import('next/cache')
  await updateSettings({
    storeName: String(formData.get('storeName') ?? ''),
    whatsappPhone: String(formData.get('whatsappPhone') ?? ''),
    deliveryText: String(formData.get('deliveryText') ?? ''),
    paymentText: String(formData.get('paymentText') ?? ''),
    currency: 'MAD',
  })
  revalidatePath('/admin/settings')
  return { ok: true }
}

/* ========================================================================
   CLIENT — commande liée au compte
   ======================================================================== */

export async function createClientOrderAction(formData: FormData) {
  'use server'
  const { revalidatePath } = await import('next/cache')

  const clientEmail = String(formData.get('clientEmail') ?? '').trim().toLowerCase()
  const customerName = String(formData.get('customerName') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const address = String(formData.get('address') ?? '').trim()
  const itemsRaw = String(formData.get('items') ?? '[]')
  const total = Number(formData.get('total') ?? 0)

  let items: Array<{ slug: string; title: string; color?: string; size?: string; quantity: number; price: number }>
  try {
    items = JSON.parse(itemsRaw)
  } catch {
    items = []
  }

  await createOrder({
    clientEmail: clientEmail || undefined,
    clientName: customerName || undefined,
    customerName,
    phone,
    address,
    items,
    total,
    status: 'en_attente',
  })

  revalidatePath('/admin/orders')
  revalidatePath('/admin/clients')
  return { ok: true }
}
