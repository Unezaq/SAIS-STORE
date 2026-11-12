import { readdirSync } from 'fs'
import { join } from 'path'

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i

/**
 * Extra gallery photos live in `public/products/{slug}/` — the same numbered
 * folders the owner manages in `Downloads/produit/{n}/`. Whatever image files
 * sit there (1.jpg, 2.jpg, IMG_xxxx.jpg…) becomes part of the product gallery,
 * sorted naturally (1, 2, 10) — no data file to edit, just drop and sync.
 */
export function getGalleryImages(slug: string): string[] {
  try {
    const dir = join(process.cwd(), 'public', 'products', slug)
    return readdirSync(dir)
      .filter((name) => IMAGE_EXT.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((name) => `/products/${slug}/${name}`)
  } catch {
    // Folder doesn't exist yet — main photo only.
    return []
  }
}
