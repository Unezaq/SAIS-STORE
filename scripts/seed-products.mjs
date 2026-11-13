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
}))

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const { error } = await supabase
  .from('products')
  .upsert(rows, { onConflict: 'slug' })

if (error) throw error

console.log(
  `Imported ${rows.length} products into Supabase project ${new URL(supabaseUrl).host}.`
)
