import type { Metadata } from 'next'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { ProductShop } from '@/components/storefront/ProductShop'
import { getProducts } from '@/lib/products'

export const metadata: Metadata = {
  title: 'La boutique — tout le catalogue SAIS',
  description:
    'Tout le catalogue SAIS sur une seule page : peignoirs, pyjamas polaires et ensembles hiver, filtrables par famille. Livraison 24–48h, paiement à la livraison.',
  alternates: { canonical: '/boutique' },
}

export default async function BoutiquePage() {
  const products = await getProducts()
  return (
    <div className="flex flex-col">
      <ScrollReveal variant="fade-up">
        <header className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-4 md:px-fib-4 md:pt-fib-6">
          <p className="text-eyebrow uppercase text-text-muted">La boutique</p>
          <h1 className="mt-fib-2 text-title text-ink [text-wrap:balance]">
            Tout le catalogue, au même endroit.
          </h1>
          <p className="mt-fib-2 max-w-xl text-sm leading-relaxed text-text-muted md:text-[15px]">
            {products.length} pièces douillettes — peignoirs, pyjamas polaires et ensembles
            d&apos;hiver. Filtrez par famille, ouvrez la fiche, commandez sur WhatsApp.
          </p>
        </header>
      </ScrollReveal>

      <ProductShop products={products} />
    </div>
  )
}
