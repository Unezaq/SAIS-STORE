import type { Metadata } from 'next'
import Link from 'next/link'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { FileText } from 'lucide-react'
import { getSettings } from '@/lib/products'

export const metadata: Metadata = {
  title: 'Conditions générales de vente — SAIS Store',
  description:
    'Conditions générales de vente de SAIS Store Kenitra. Commande, paiement à la livraison, livraison 24–48h partout au Maroc.',
  alternates: { canonical: '/conditions' },
}

export default async function ConditionsPage() {
  const settings = await getSettings()
  const whatsappLink = `https://wa.me/${settings.whatsappPhone}`

  return (
    <div className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-4 md:px-fib-4 md:pt-fib-6">
      <ScrollReveal variant="fade-up">
        <header className="mb-fib-4 max-w-2xl md:mb-fib-5">
          <p className="text-eyebrow uppercase text-text-muted">Conditions générales</p>
          <h1 className="mt-fib-1 text-title text-ink [text-wrap:balance]">
            Conditions de vente
          </h1>
          <p className="mt-fib-2 max-w-xl text-sm leading-relaxed text-text-muted md:text-[15px]">
            En commandant chez SAIS Store, vous acceptez les conditions
            ci-dessous. Paiement à la livraison partout au Maroc.
          </p>
        </header>
      </ScrollReveal>

      <ScrollReveal variant="fade-up" delay={0.05}>
        <section className="mx-auto w-full max-w-7xl px-fib-3 md:px-fib-4">
          <div className="grid gap-fib-3 md:grid-cols-12 md:gap-fib-4">
            <div className="rounded-[24px] bg-surface-soft p-fib-4 md:col-span-12">
              <div className="flex items-start gap-fib-2">
                <span className="mt-0.5 shrink-0 text-ink">
                  <FileText size={17} strokeWidth={1.8} />
                </span>
                <div>
                  <h2 className="mt-0 text-heading text-ink">
                    Commande et paiement
                  </h2>
                  <ul className="mt-fib-2 space-y-fib-1 text-sm leading-relaxed text-text-muted">
                    <li>
                      Les commandes se passent uniquement via le site ou par
                      WhatsApp avec une conseillère.
                    </li>
                    <li>
                      Le paiement se fait <strong>en espèces à la réception</strong>,
                      après vérification de la pièce. Aucun paiement en ligne
                      n’est demandé.
                    </li>
                    <li>
                      Les prix sont affichés en dirhams marocains (MAD) et sont
                      revérifiés côté serveur avant validation de la commande.
                    </li>
                    <li>
                      Une référence de commande <strong>SAIS-…</strong> vous est
                      communiquée pour suivre votre commande.
                    </li>
                  </ul>
                  <h3 className="mt-fib-3 text-heading text-ink">
                    Livraison
                  </h3>
                  <ul className="mt-fib-1 space-y-fib-1 text-sm leading-relaxed text-text-muted">
                    <li>
                      Livraison dans tout le Maroc sous 24 à 48h ouvrées.
                    </li>
                    <li>
                      Frais de livraison de {settings.deliveryFee} MAD,
                      {settings.freeDeliveryMinItems > 0
                        ? `offerte dès ${settings.freeDeliveryMinItems} pièces`
                        : 'applicable à chaque commande'}.
                    </li>
                    <li>
                      Vous êtes contacté par téléphone pour confirmer l’adresse
                      avant expédition.
                    </li>
                  </ul>
                  <h3 className="mt-fib-3 text-heading text-ink">
                    Retours et échanges
                  </h3>
                  <ul className="mt-fib-1 space-y-fib-1 text-sm leading-relaxed text-text-muted">
                    <li>
                      Un échange est possible dans les 48h suivant la réception,
                      si la pièce est non portée avec son emballage.
                    </li>
                    <li>
                      Contactez-nous sur WhatsApp pour toute demande de retour
                      ou d’échange.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal variant="fade-up">
        <section className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-6 pb-fib-6 md:px-fib-4 md:pt-fib-7 md:pb-fib-8">
          <div className="rounded-[28px] bg-primary px-fib-4 py-fib-5 text-white md:px-fib-5 md:py-fib-6">
            <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] md:text-[26px]">
              Une question sur ces conditions ?
            </h2>
            <p className="mt-fib-1 max-w-lg text-sm text-white/70">
              Une conseillère répond sur WhatsApp 7j/7 de 9h à 21h.
            </p>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="press inline-flex items-center gap-2 rounded-full bg-white px-fib-3 py-fib-1 text-sm font-medium text-primary hover:bg-white/90"
            >
              Écrire sur WhatsApp
            </a>
          </div>
        </section>
      </ScrollReveal>
    </div>
  )
}
