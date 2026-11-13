import type { Metadata } from 'next'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { ProductShop } from '@/components/storefront/ProductShop'
import { getStorefrontProducts } from '@/lib/products'

export const metadata: Metadata = {
  title: 'La boutique — tout le catalogue SAIS',
  description:
    'Tout le catalogue SAIS sur une seule page : peignoirs, pyjamas polaires et ensembles hiver, filtrables par famille. Livraison 24–48h, paiement à la livraison.',
  alternates: { canonical: '/boutique' },
}

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export default async function BoutiquePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const products = await getStorefrontProducts()
  const params = await searchParams
  const query = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? ''
  const search = normalizeSearch(query)
  const visibleProducts = search
    ? products.filter((product) =>
        normalizeSearch([
          product.title,
          product.slug,
          product.categoryName,
          product.description ?? '',
          product.ref ?? '',
          ...(product.colors ?? []).map((color) => color.name),
        ].join(' ')).includes(search)
      )
    : products

  return (
    <div className="flex flex-col">
      <ScrollReveal variant="fade-up">
        <header className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-4 md:px-fib-4 md:pt-fib-6">
          <p className="text-eyebrow uppercase text-text-muted">La boutique</p>
          <h1 className="mt-fib-2 text-title text-ink [text-wrap:balance]">
            {query ? `Résultats pour « ${query} »` : 'Tout le catalogue, au même endroit.'}
          </h1>
          <p className="mt-fib-2 max-w-xl text-sm leading-relaxed text-text-muted md:text-[15px]">
            {query
              ? `${visibleProducts.length} résultat${visibleProducts.length === 1 ? '' : 's'} trouvé${visibleProducts.length === 1 ? '' : 's'}.`
              : `${products.length} pièces douillettes — peignoirs, pyjamas polaires et ensembles d'hiver. Filtrez par famille, ouvrez la fiche, commandez sur WhatsApp.`}
          </p>
        </header>
      </ScrollReveal>

      <ProductShop
        products={visibleProducts}
        emptyMessage={query ? 'Aucun produit ne correspond à cette recherche.' : undefined}
      />
    </div>
  )
}
