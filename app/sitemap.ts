import type { MetadataRoute } from 'next'
import { clientEnv } from '@/lib/env'
import { getProducts } from '@/lib/products'
import { COLLECTION_SLUGS } from '@/lib/data'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = clientEnv.NEXT_PUBLIC_SITE_URL
  const products = await getProducts()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/boutique`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/promotions`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/espace-client`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/collections`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/wishlist`, changeFrequency: 'monthly', priority: 0.3 },
  ]

  const collectionRoutes: MetadataRoute.Sitemap = COLLECTION_SLUGS.filter(
    (slug) => slug !== 'all'
  ).map((slug) => ({
    url: `${base}/collections/${slug}`,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${base}/products/${product.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: product.originalPrice ? 0.9 : 0.8,
  }))

  return [...staticRoutes, ...collectionRoutes, ...productRoutes]
}
