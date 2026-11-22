import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local before importing products.'
  )
}

if (!process.argv.includes('--confirm')) {
  throw new Error(
    `This will upsert catalog products into ${new URL(supabaseUrl).host}. Rerun with --confirm only after verifying this is the intended project.`
  )
}

const store = JSON.parse(
  await readFile(join(process.cwd(), 'data', 'store.json'), 'utf8')
)

if (!Array.isArray(store.products) || store.products.length === 0) {
  throw new Error('data/store.json does not contain any products to import.')
}

const rows = store.products.map((product) => ({
  title: product.title,
  slug: product.slug,
  slug_category: product.slugCategory,
  category_name: product.categoryName,
  price: product.price,
  original_price: product.originalPrice ?? null,
  image_url: product.imageUrl,
  colors: product.colors ?? [],
  color_images: product.colorImages ?? {},
  sizes: product.sizes ?? ['S', 'M', 'L', 'XL', 'XXL'],
  fabric: product.fabric ?? null,
  features: product.features ?? [],
  badge: product.badge ?? null,
  ref: product.ref ?? null,
  description: product.description ?? null,
  is_active: true,
  stock: 25,
}))

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const { data: importedProducts, error: productError } = await supabase
  .from('products')
  .upsert(rows, { onConflict: 'slug' })
  .select('id, slug')

if (productError) throw productError
if (!importedProducts || importedProducts.length !== rows.length) {
  throw new Error('Could not retrieve all imported product IDs to seed their variants.')
}

const productIds = importedProducts.map((product) => product.id)
const { data: existingVariants, error: variantsReadError } = await supabase
  .from('product_variants')
  .select('product_id, size, color')
  .in('product_id', productIds)

if (variantsReadError) throw variantsReadError

const existingVariantKeys = new Set(
  (existingVariants ?? []).map(
    (variant) => `${variant.product_id}\u0000${variant.size ?? ''}\u0000${variant.color ?? ''}`
  )
)
const productsBySlug = new Map(store.products.map((product) => [product.slug, product]))
const variants = importedProducts.flatMap((importedProduct) => {
  const product = productsBySlug.get(importedProduct.slug)
  if (!product) throw new Error(`Could not find source data for ${importedProduct.slug}.`)

  const sizes = product.sizes ?? ['S', 'M', 'L', 'XL', 'XXL']
  const colors = (product.colors ?? []).map((color) => color.name)

  return sizes.flatMap((size) =>
    colors.map((color) => ({
      product_id: importedProduct.id,
      size,
      color,
      stock: 25,
      price_adjustment: 0,
    }))
  )
})
const missingVariants = variants.filter(
  (variant) =>
    !existingVariantKeys.has(`${variant.product_id}\u0000${variant.size}\u0000${variant.color}`)
)

if (missingVariants.length > 0) {
  const { error: variantsInsertError } = await supabase
    .from('product_variants')
    .insert(missingVariants)

  if (variantsInsertError) throw variantsInsertError
}

console.log(
  `Imported ${rows.length} products and added ${missingVariants.length} missing variants into Supabase project ${new URL(supabaseUrl).host}.`
)
