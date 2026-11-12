import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { ProductGrid } from '@/components/storefront/ProductGrid'
import { ProductActions } from '@/components/storefront/ProductActions'
import { ProductGallery } from '@/components/storefront/ProductGallery'
import { getGalleryImages } from '@/lib/gallery'
import { Badge } from '@/components/ui/Badge'
import { JsonLd, productJsonLd, breadcrumbJsonLd } from '@/lib/seo'
import { getProduct, getProducts } from '@/lib/products'
import { categories } from '@/lib/data'
import { formatMAD } from '@/lib/utils'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const product = await getProduct(slug)

  if (!product) return { title: 'Pièce introuvable' }

  const description = `${product.description ?? ''} Livraison 24–48h partout au Maroc, paiement à la livraison. Commande sur WhatsApp.`
  const onSale = product.originalPrice && product.originalPrice > product.price

  return {
    title: product.title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: 'website',
      title: `${product.title} — ${formatMAD(product.price)}`,
      description,
      images: [{ url: product.imageUrl, alt: product.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.title} — ${formatMAD(product.price)}`,
      description,
      images: [product.imageUrl],
    },
    other: onSale
      ? { 'product:price:amount': String(product.price), 'product:price:currency': 'MAD' }
      : undefined,
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const product = await getProduct(slug)

  if (!product) {
    notFound()
  }

  const allProducts = await getProducts()
  const related = allProducts.filter((p) => p.id !== product.id).slice(0, 4)
  const jsonLd = await productJsonLd(product.slug)

  return (
    <div className="flex flex-col">
      {jsonLd && <JsonLd data={jsonLd} />}
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          { name: 'Boutique', path: '/boutique' },
          { name: product.categoryName, path: `/collections/${product.slugCategory}` },
          { name: product.title, path: `/products/${product.slug}` },
        ])}
      />
      <section className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-3 md:px-fib-4 md:pt-fib-4">
        <div className="gap-8 md:gap-12 lg:grid lg:grid-cols-12">
          {/* Gallery */}
          <div className="relative lg:col-span-6">
            <ProductGallery
              images={[
                product.imageUrl,
                ...Object.values(product.colorImages ?? {}).filter(
                  (src) => src !== product.imageUrl
                ),
                ...getGalleryImages(product.slug),
              ]}
              alt={product.title}
              colorImages={product.colorImages}
            />
            {product.badge && (
              <div className="absolute top-4 start-4 z-20">
                <Badge variant="primary" size="sm">
                  {product.badge}
                </Badge>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            <ScrollReveal variant="fade-up" delay={0.05}>
              <div>
                <span className="text-eyebrow uppercase text-text-muted">
                  {product.categoryName}
                </span>
                <h1 className="mt-2 mb-3 text-title text-ink">
                  {product.title}
                </h1>
                <div className="flex items-baseline gap-3 md:gap-4 mb-1">
                  <span className="tabular text-xl font-semibold text-ink md:text-2xl">
                    {formatMAD(product.price)}
                  </span>
                  {product.originalPrice && product.originalPrice > product.price && (
                    <>
                      <span className="text-sm text-text-muted/70 line-through">
                        {formatMAD(product.originalPrice)}
                      </span>
                      <span className="text-xs font-bold text-rose-600">
                        -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
                      </span>
                    </>
                  )}
                </div>
              </div>
            </ScrollReveal>

            {/* Quantity + Actions */}
            <ScrollReveal variant="fade-up" delay={0.15}>
              <ProductActions product={product} />
            </ScrollReveal>

            {/* Description + details */}
            <ScrollReveal variant="fade-up" delay={0.25}>
              <div className="pt-6 border-t border-border/50">
                <h3 className="mb-3 text-eyebrow uppercase text-text-muted">
                  Détails de la pièce
                </h3>
                <p className="text-sm md:text-base text-text-muted leading-relaxed">
                  {product.description}
                </p>

                {product.fabric && (
                  <p className="mt-4 text-sm md:text-base text-ink">
                    <span className="font-medium">Matière :</span>{' '}
                    <span className="text-text-muted">{product.fabric}</span>
                  </p>
                )}

                {product.features && product.features.length > 0 && (
                  <ul className="mt-4 flex flex-col gap-2">
                    {product.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-sm md:text-base text-text-muted"
                      >
                        <span
                          aria-hidden
                          className="mt-[0.5em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </ScrollReveal>
          </div>
        </div>

        {/* Related products */}
        <ScrollReveal variant="fade-up" delay={0.35}>
          <section className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-heading text-ink md:text-xl">
                Vous aimerez aussi
              </h2>
              <Link href="/boutique" className="press flex items-center gap-1.5 text-sm font-medium text-ink">
                <span>Voir tout</span>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" className="rotate-180">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
            </div>
            <ProductGrid
              products={related}
              className="grid grid-cols-2 gap-x-3.5 gap-y-8 md:grid-cols-4 md:gap-x-6"
            />
          </section>
        </ScrollReveal>
      </section>
    </div>
  )
}
