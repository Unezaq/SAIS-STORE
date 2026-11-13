export interface ProductColor {
  name: string
  hex: string
}

export interface Product {
  id: string
  title: string
  slug: string
  slugCategory: string
  price: number
  originalPrice?: number
  imageUrl: string
  colors?: ProductColor[]
  colorImages?: Record<string, string>
  videoUrl?: string
  ref?: string
  sizes?: string[]
  fabric?: string
  features?: string[]
  categoryName: string
  badge?: string
  description?: string
}

export interface Category {
  name: string
  slug: string
  imageUrl: string
}

export const categories: Category[] = [
  { name: 'Toutes', slug: 'all', imageUrl: '/products/sais-01.jpg' },
  { name: 'Peignoirs', slug: 'peignoirs', imageUrl: '/products/sais-04.jpg' },
  { name: 'Pyjamas Polaires', slug: 'pyjamas', imageUrl: '/products/sais-13.jpg' },
  { name: 'Ensembles Hiver', slug: 'ensembles', imageUrl: '/products/sais-17.jpg' },
]

export const COLLECTION_SLUGS = ['all', 'peignoirs', 'pyjamas', 'ensembles', 'nouveautes']

export function discountPercent(product: Product): number {
  if (!product.originalPrice || product.originalPrice <= product.price) return 0
  return Math.round(
    ((product.originalPrice - product.price) / product.originalPrice) * 100
  )
}
