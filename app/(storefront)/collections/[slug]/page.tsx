import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { ProductGrid } from '@/components/storefront/ProductGrid'
import { categories, COLLECTION_SLUGS } from '@/lib/data'
import { getProductsByCategory } from '@/lib/products'

const categoryTitle: Record<string, string> = {
  peignoirs: 'Peignoirs',
  pyjamas: 'Pyjamas Polaires',
  ensembles: 'Ensembles Hiver',
  all: 'Toutes les pièces',
  nouveautes: 'Nouveautés',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const title = categoryTitle[slug]

  if (!title) return { title: 'Collection' }

  return {
    title,
    description: `Découvrez notre collection ${title.toLowerCase()} : pièces douces et chaudes, livraison 24–48h partout au Maroc, paiement à la livraison.`,
    alternates: { canonical: `/collections/${slug}` },
  }
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const categoryProducts = await getProductsByCategory(slug)
  const category = categories.find((c) => c.slug === slug)

  if (!category && !COLLECTION_SLUGS.includes(slug)) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-fib-4 md:gap-fib-6">
      <section className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-4 md:px-fib-4 md:pt-fib-5">
        <div className="mb-fib-4 flex items-end justify-between gap-fib-2 md:mb-fib-5">
          <div>
            <p className="text-eyebrow uppercase text-text-muted">Collection</p>
            <h1 className="mt-fib-1 text-title text-ink">
              {categoryTitle[slug] || category?.name || 'Collection'}
            </h1>
            <p className="tabular mt-fib-1 text-sm text-text-muted">
              {categoryProducts.length} pièce{categoryProducts.length > 1 ? 's' : ''} disponible{categoryProducts.length > 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href="/boutique"
            className="press mb-fib-1 flex shrink-0 items-center gap-1.5 text-sm font-medium text-ink"
          >
            <span>Voir la boutique</span>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" className="rotate-180">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
        </div>

        <ScrollReveal variant="fade-up" delay={0.05}>
          <ProductGrid
            products={categoryProducts}
            className="grid grid-cols-2 gap-x-fib-2 gap-y-fib-4 md:grid-cols-3 md:gap-x-fib-3 lg:grid-cols-4"
          />
        </ScrollReveal>
      </section>
    </div>
  )
}
