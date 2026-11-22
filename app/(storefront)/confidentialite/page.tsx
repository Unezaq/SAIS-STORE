import type { Metadata } from 'next'
import Link from 'next/link'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { ShieldCheck } from 'lucide-react'
import { getSettings } from '@/lib/products'

export const metadata: Metadata = {
  title: 'Confidentialité — SAIS Store | Protection des données',
  description:
    'SAIS Store protège vos données personnelles. Commande, livraison et paiement à la livraison partout au Maroc.',
  alternates: { canonical: '/confidentialite' },
}

export default async function ConfidentialitePage() {
  const settings = await getSettings()
  const whatsappLink = `https://wa.me/${settings.whatsappPhone}`

  return (
    <div className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-4 md:px-fib-4 md:pt-fib-6">
      <ScrollReveal variant="fade-up">
        <header className="mb-fib-4 max-w-2xl md:mb-fib-5">
          <p className="text-eyebrow uppercase text-text-muted">Confidentialité</p>
          <h1 className="mt-fib-1 text-title text-ink [text-wrap:balance]">
            Protection de vos données
          </h1>
          <p className="mt-fib-2 max-w-xl text-sm leading-relaxed text-text-muted md:text-[15px]">
            Vos informations servent uniquement à préparer et livrer votre
            commande. Aucun paiement en ligne n’est effectué sur le site.
          </p>
        </header>
      </ScrollReveal>

      <ScrollReveal variant="fade-up" delay={0.05}>
        <section className="mx-auto w-full max-w-7xl px-fib-3 md:px-fib-4">
          <div className="grid gap-fib-3 md:grid-cols-12 md:gap-fib-4">
            <div className="rounded-[24px] bg-surface-soft p-fib-4 md:col-span-12">
              <div className="flex items-start gap-fib-2">
                <span className="mt-0.5 shrink-0 text-ink">
                  <ShieldCheck size={17} strokeWidth={1.8} />
                </span>
                <div>
                  <h2 className="mt-0 text-heading text-ink">
                    Données collectées
                  </h2>
                  <ul className="mt-fib-2 space-y-fib-1 text-sm leading-relaxed text-text-muted">
                    <li>
                      Nom complet, numéro de téléphone, ville et adresse —
                      requis pour la livraison.
                    </li>
                    <li>
                      Email facultatif — utilisé pour le récapitulatif de
                      commande.
                    </li>
                    <li>
                      Aucun donnée de paiement n’est stockée : le règlement se
                      fait en espèces à la réception.
                    </li>
                  </ul>
                  <h3 className="mt-fib-3 text-heading text-ink">
                    Utilisation de vos données
                  </h3>
                  <p className="mt-fib-1 text-sm leading-relaxed text-text-muted">
                    Vos coordonnées servent à préparer votre commande, à vous
                    appeler pour confirmer la livraison et à vous tenir informé
                    du statut de votre commande. Elles ne sont pas vendues ni
                    transmises à des tiers à des fins commerciales.
                  </p>
                  <h3 className="mt-fib-3 text-heading text-ink">
                    Vos droits
                  </h3>
                  <p className="mt-fib-1 text-sm leading-relaxed text-text-muted">
                    Vous pouvez accéder, corriger ou supprimer vos données en
                    nous écrivant sur WhatsApp. Nous répondons 7j/7 de 9h à 21h.
                  </p>
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
              Une question sur la confidentialité ?
            </h2>
            <p className="mt-fib-1 max-w-lg text-sm text-white/70">
              Une conseillère répond sur WhatsApp en quelques minutes.
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
