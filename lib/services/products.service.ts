import { cache } from 'react'
import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Product } from '@/lib/data'

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
  is_active?: boolean
  stock?: number
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    slugCategory: row.slug_category,
    categoryName: row.category_name,
    price: Number(row.price),
    originalPrice: row.original_price != null ? Number(row.original_price) : undefined,
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

function toProductRow(product: Product) {
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
    is_active: true,
    updated_at: new Date().toISOString(),
  }
}

export const getProducts = cache(async (): Promise<Product[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => mapProduct(row as ProductRow))
})

export const getProduct = cache(async (slug: string): Promise<Product | undefined> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  return data ? mapProduct(data as ProductRow) : undefined
})

export const getProductsByCategory = cache(async (categorySlug: string): Promise<Product[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug_category', categorySlug)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => mapProduct(row as ProductRow))
})

export const getPromoProducts = cache(async (): Promise<Product[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .not('original_price', 'is', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? [])
    .map((row) => mapProduct(row as ProductRow))
    .filter((product) => Boolean(product.originalPrice && product.originalPrice > product.price))
})

export async function upsertProduct(product: Product): Promise<void> {
  const supabase = createAdminClient()
  const row = toProductRow(product)
  const { error } = await supabase
    .from('products')
    .upsert(row, { onConflict: 'slug' })

  if (error) throw error
}

export async function deleteProduct(slug: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('slug', slug)

  if (error) throw error
}
