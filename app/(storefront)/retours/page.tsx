import type { Metadata } from 'next'
import Link from 'next/link'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { AlertTriangle } from 'lucide-react'
import { getSettings } from '@/lib/products'

export const metadata: Metadata = {
  title: 'Retours et échanges — SAIS Store',
  description:
    'Échangez une pièce qui ne convient pas chez SAIS Store. Contactez-nous sur WhatsApp dans les 48h suivant la réception. Paiement à la livraison partout au Maroc.',
  alternates: { canonical: '/retours' },
}

export default async function RetoursPage() {
  const settings = await getSettings()
  const whatsappLink = `https://wa.me/${settings.whatsappPhone}`

  return (
    <div className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-4 md:px-fib-4 md:pt-fib-6">
      <ScrollReveal variant="fade-up">
        <header className="mb-fib-4 max-w-2xl md:mb-fib-5">
          <p className="text-eyebrow uppercase text-text-muted">Retours et échanges</p>
          <h1 className="mt-fib-1 text-title text-ink [text-wrap:balance]">
            Pièce qui ne convient pas ?
          </h1>
          <p className="mt-fib-2 max-w-xl text-sm leading-relaxed text-text-muted md:text-[15px]">
            Un échange est possible si la pièce ne vous convient pas. Contactez-nous
            rapidement sur WhatsApp.
          </p>
        </header>
      </ScrollReveal>

      <ScrollReveal variant="fade-up" delay={0.05}>
        <section className="mx-auto w-full max-w-7xl px-fib-3 md:px-fib-4">
          <div className="grid gap-fib-3 md:grid-cols-12 md:gap-fib-4">
            {/* Conditions */}
            <div className="rounded-[24px] bg-surface-soft p-fib-4 md:col-span-7">
              <div className="flex items-start gap-fib-2">
                <span className="mt-0.5 shrink-0 text-ink">
                  <AlertTriangle size={17} strokeWidth={1.8} />
                </span>
                <div>
                  <h2 className="mt-0 text-heading text-ink">
                    Conditions d’échange
                  </h2>
                  <ul className="mt-fib-2 space-y-fib-1 text-sm leading-relaxed text-text-muted">
                    <li>
                      Contactez-nous sur WhatsApp <strong>dans les 48h</strong>
                      suivant la réception de votre commande.
                    </li>
                    <li>
                      La pièce doit être <strong>non portée</strong>, avec son
                      emballage d’origine et ses étiquettes.
                    </li>
                    <li>
                      Nous vous rappelons pour convenir de l’échange et de la
                      reprise de la pièce.
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="flex flex-col gap-fib-2 md:col-span-5">
              <div className="rounded-[24px] bg-primary p-fib-4 text-white">
                <h2 className="text-heading text-white">Nous écrire sur WhatsApp</h2>
                <p className="mt-fib-1 text-sm text-white/70">
                  Une conseillère vous guide pour l’échange de votre pièce.
                </p>
                <a
                  href={`${whatsappLink}?text=${encodeURIComponent(
                    'Bonjour SAIS Store 👋 Je souhaite échanger une pièce de ma commande.'
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="press mt-fib-3 inline-flex items-center gap-2 rounded-full bg-white px-fib-3 py-fib-1 text-sm font-medium text-primary hover:bg-white/90"
                >
                  Écrire sur WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal variant="fade-up">
        <section className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-6 pb-fib-6 md:px-fib-4 md:pt-fib-7 md:pb-fib-8">
          <div className="rounded-[28px] bg-primary px-fib-4 py-fib-5 text-white md:px-fib-5 md:py-fib-6">
            <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] md:text-[26px]">
              Une question sur un retour ?
            </h2>
            <p className="mt-fib-1 max-w-lg text-sm text-white/70">
              Une conseillère répond sur WhatsApp 7j/7 de 9h à 21h.
            </p>
            <Link
              href="/suivre"
              className="press inline-flex items-center gap-2 rounded-full bg-white px-fib-3 py-fib-1 text-sm font-medium text-primary hover:bg-white/90"
            >
              Suivre ma commande
            </Link>
          </div>
        </section>
      </ScrollReveal>
    </div>
  )
}
