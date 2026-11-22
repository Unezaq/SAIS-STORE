import type { Metadata } from 'next'
import Link from 'next/link'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { Truck } from 'lucide-react'
import { getSettings } from '@/lib/products'

export const metadata: Metadata = {
  title: 'Livraison — SAIS Store | 24–48h partout au Maroc',
  description:
    'Livraison partout au Maroc sous 24–48h avec SAIS Store. Paiement à la livraison. Frais de livraison et conditions de gratuité.',
  alternates: { canonical: '/livraison' },
}

export default async function LivraisonPage() {
  const settings = await getSettings()
  const freeDelivery = settings.freeDeliveryMinItems > 0

  return (
    <div className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-4 md:px-fib-4 md:pt-fib-6">
      <ScrollReveal variant="fade-up">
        <header className="mb-fib-4 max-w-2xl md:mb-fib-5">
          <p className="text-eyebrow uppercase text-text-muted">Livraison</p>
          <h1 className="mt-fib-1 text-title text-ink [text-wrap:balance]">
            Livraison partout au Maroc
          </h1>
          <p className="mt-fib-2 max-w-xl text-sm leading-relaxed text-text-muted md:text-[15px]">
            Votre commande est livrée directement à votre adresse. Vous réglez en
            espèces à la réception, après avoir vérifié la pièce.
          </p>
        </header>
      </ScrollReveal>

      <ScrollReveal variant="fade-up" delay={0.05}>
        <section className="mx-auto w-full max-w-7xl px-fib-3 md:px-fib-4">
          <div className="grid gap-fib-3 md:grid-cols-12 md:gap-fib-4">
            {/* Delivery promise */}
            <div className="rounded-[24px] bg-surface-soft p-fib-4 md:col-span-7">
              <div className="flex items-start gap-fib-2">
                <span className="mt-0.5 shrink-0 text-ink">
                  <Truck size={17} strokeWidth={1.8} />
                </span>
                <div>
                  <h2 className="mt-0 text-heading text-ink">
                    Zones et délais de livraison
                  </h2>
                  <p className="mt-fib-1 text-sm leading-relaxed text-text-muted">
                    SAIS livre dans tout le Maroc, y compris à Kenitra, Rabat,
                    Casablanca et les villes environnantes. Le délai de livraison
                    est de 24 à 48h ouvrées après confirmation de votre commande
                    par téléphone.
                  </p>
                </div>
              </div>
            </div>

            {/* Shipping cost */}
            <div className="flex flex-col gap-fib-2 md:col-span-5">
              <div className="rounded-[24px] bg-white p-fib-4 shadow-sm ring-1 ring-hairline">
                <h2 className="text-heading text-ink">Frais de livraison</h2>
                <p className="mt-fib-1 text-lg font-semibold text-ink">
                  {settings.deliveryFee} MAD
                </p>
                {freeDelivery && (
                  <p className="mt-fib-2 text-sm text-text-muted">
                    Livraison offerte dès {settings.freeDeliveryMinItems} pièces
                    dans la commande.
                  </p>
                )}
                <p className="mt-fib-2 text-xs leading-relaxed text-text-muted">
                  Le montant de la livraison vous est confirmé avant validation
                  de la commande. Paiement en espèces à la réception.
                </p>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal variant="fade-up">
        <section className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-6 pb-fib-6 md:px-fib-4 md:pt-fib-7 md:pb-fib-8">
          <div className="rounded-[28px] bg-primary px-fib-4 py-fib-5 text-white md:px-fib-5 md:py-fib-6">
            <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] md:text-[26px]">
              Prête à commander ?
            </h2>
            <p className="mt-fib-1 max-w-lg text-sm text-white/70">
              Choisissez vos pièces et nous vous livrons partout au Maroc en
              24–48h avec paiement à la livraison.
            </p>
            <Link
              href="/boutique"
              className="press inline-flex items-center gap-2 rounded-full bg-white px-fib-3 py-fib-1 text-sm font-medium text-primary hover:bg-white/90"
            >
              Parcourir la boutique
            </Link>
          </div>
        </section>
      </ScrollReveal>
    </div>
  )
}
