import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { ProductGrid } from '@/components/storefront/ProductGrid'
import { JsonLd, breadcrumbJsonLd } from '@/lib/seo'
import { discountPercent, getPromoProducts, getProducts } from '@/lib/products'
import { clientEnv } from '@/lib/env'
import { formatMAD } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Promotions — Réductions en cours',
  description:
    'Les offres du moment chez SAIS Store : peignoirs, pyjamas polaires et ensembles hiver à prix réduit. Livraison partout au Maroc, paiement à la livraison.',
  alternates: { canonical: '/promotions' },
}

/**
 * Promotions page: every product currently on sale, deepest discount first.
 * A single savings total keeps the offer concrete instead of vague.
 */
export default async function PromotionsPage() {
  const promoProducts = await getPromoProducts()
  const allProducts = await getProducts()
  const totalSavings = promoProducts.reduce(
    (sum, p) => sum + (p.originalPrice! - p.price),
    0
  )
  const maxDiscount = promoProducts.reduce(
    (max, p) => Math.max(max, discountPercent(p)),
    0
  )

  return (
    <div className="flex flex-col">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          { name: 'Promotions', path: '/promotions' },
        ])}
      />

      <ScrollReveal variant="fade-up">
        <header className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-4 md:px-fib-4 md:pt-fib-6">
          <p className="text-eyebrow uppercase text-text-muted">Offres en cours</p>
          <h1 className="mt-fib-2 text-title text-ink [text-wrap:balance]">
            Promotions — jusqu&apos;à -{maxDiscount}%
          </h1>
          <p className="mt-fib-2 max-w-xl text-sm leading-relaxed text-text-muted md:text-[15px]">
            {promoProducts.length} pièces à prix réduit, pour une durée limitée. Même
            qualité, même livraison 24–48h, paiement à la réception.
          </p>
        </header>
      </ScrollReveal>

      {/* Savings banner */}
      <section className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-4 md:px-fib-4">
        <ScrollReveal variant="fade-up" delay={0.05}>
          <div className="flex flex-wrap items-center justify-between gap-fib-3 rounded-[24px] bg-surface-soft px-fib-3 py-fib-3 md:px-fib-4 md:py-fib-4">
            <div className="flex items-center gap-fib-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                <Sparkles size={17} strokeWidth={1.8} />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-ink">
                  Économie totale sur l&apos;offre : {formatMAD(totalSavings)}
                </p>
                <p className="text-xs text-text-muted">
                  Sur les {promoProducts.length} pièces en promotion, sur un catalogue de{' '}
                  {allProducts.length} pièces.
                </p>
              </div>
            </div>
            <Link
              href="/boutique"
              className="press rounded-full bg-ink px-fib-3 py-fib-1 text-sm font-medium text-white transition-colors hover:bg-ink/90"
            >
              Voir toute la boutique
            </Link>
          </div>
        </ScrollReveal>
      </section>

      {/* Promo grid */}
      <section className="mx-auto w-full max-w-7xl px-fib-3 py-fib-4 md:px-fib-4 md:py-fib-5">
        <p className="text-eyebrow uppercase text-text-muted">Catalogue promo</p>
        <ProductGrid
          products={promoProducts}
          className="mt-fib-3 grid grid-cols-2 gap-x-fib-2 gap-y-fib-4 md:grid-cols-3 md:gap-x-fib-3 lg:grid-cols-4"
        />
      </section>

      {/* Contact CTA */}
      <section className="mx-auto w-full max-w-7xl px-fib-3 pb-fib-6 md:px-fib-4 md:pb-fib-7">
        <ScrollReveal variant="fade-up">
          <div className="rounded-[28px] bg-primary px-fib-4 py-fib-5 text-white md:px-fib-5 md:py-fib-6">
            <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] md:text-[26px]">
              Une question sur une promotion ?
            </h2>
            <p className="mt-fib-1 max-w-lg text-sm text-white/70">
              Une conseillère répond sur WhatsApp en quelques minutes — tailles,
              coloris et disponibilité.
            </p>
            <a
              href={`https://wa.me/${clientEnv.NEXT_PUBLIC_WHATSAPP_PHONE}`}
              target="_blank"
              rel="noreferrer"
              className="press mt-fib-3 inline-flex items-center gap-2 rounded-full bg-white px-fib-3 py-fib-1 text-sm font-medium text-primary hover:bg-white/90"
            >
              Écrire sur WhatsApp
            </a>
          </div>
        </ScrollReveal>
      </section>
    </div>
  )
}
