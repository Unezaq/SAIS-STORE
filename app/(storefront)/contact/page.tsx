import type { Metadata } from 'next'
import Link from 'next/link'
import { MessageCircle, Phone } from 'lucide-react'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { Button } from '@/components/ui/Button'
import { getSettings } from '@/lib/products'
import { formatMoroccanPhone, whatsappNumber } from '@/lib/phone'

export const metadata: Metadata = {
  title: 'Contact — SAIS Store Kenitra',
  description:
    'Contactez SAIS Store à Kenitra pour vos commandes, tailles, coloris et suivi. WhatsApp 7j/7 de 9h à 21h. Paiement à la livraison partout au Maroc.',
  alternates: { canonical: '/contact' },
}

export default async function ContactPage() {
  const settings = await getSettings()
  const whatsappLink = `https://wa.me/${settings.whatsappPhone}`
  const whatsappMessage = `https://wa.me/${settings.whatsappPhone}?text=${encodeURIComponent(
    'Bonjour SAIS Store 👋 Je souhaite passer une commande ou poser une question.'
  )}`
  const phoneFormatted = formatMoroccanPhone(settings.whatsappPhone)

  return (
    <div className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-4 md:px-fib-4 md:pt-fib-6">
      <ScrollReveal variant="fade-up">
        <header className="mb-fib-4 max-w-2xl md:mb-fib-5">
          <p className="text-eyebrow uppercase text-text-muted">Contact</p>
          <h1 className="mt-fib-1 text-title text-ink [text-wrap:balance]">
            Nous écrire
          </h1>
          <p className="mt-fib-2 max-w-xl text-sm leading-relaxed text-text-muted md:text-[15px]">
            Une conseillère répond sur WhatsApp pour vos commandes, vos tailles,
            vos coloris et le suivi de votre commande.
          </p>
        </header>
      </ScrollReveal>

      <ScrollReveal variant="fade-up" delay={0.05}>
        <section className="mx-auto w-full max-w-7xl px-fib-3 md:px-fib-4">
          <div className="grid gap-fib-3 md:grid-cols-12 md:gap-fib-4">
            {/* WhatsApp — primary contact */}
            <div className="rounded-[24px] bg-primary p-fib-4 text-white md:col-span-7">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
                <MessageCircle size={17} strokeWidth={1.8} />
              </span>
              <h2 className="mt-fib-3 text-heading">Nous écrire sur WhatsApp</h2>
              <p className="mt-fib-1 max-w-md text-sm leading-relaxed text-white/70">
                Le moyen le plus rapide : commandes, tailles, coloris, suivi — une
                conseillère répond en quelques minutes, 7j/7 de 9h à 21h.
              </p>
              <div className="mt-fib-3 flex flex-wrap gap-fib-2">
                <a
                  href={whatsappMessage}
                  target="_blank"
                  rel="noreferrer"
                  className="press inline-flex items-center gap-2 rounded-full bg-white px-fib-3 py-fib-1 text-sm font-medium text-primary hover:bg-white/90"
                >
                  <MessageCircle size={15} />
                  Ouvrir WhatsApp
                </a>
                <Link
                  href="/boutique"
                  className="press inline-flex items-center gap-2 rounded-full bg-white/10 px-fib-3 py-fib-1 text-sm font-medium text-white backdrop-blur-md hover:bg-white/15"
                >
                  Parcourir la boutique
                </Link>
              </div>
            </div>

            {/* Practical info */}
            <div className="flex flex-col gap-fib-2 md:col-span-5">
              <div className="flex items-start gap-fib-2 rounded-[24px] bg-surface-soft p-fib-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink">
                  <Phone size={17} strokeWidth={1.8} />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-ink">Téléphone</p>
                  <a
                    href={`tel:+${settings.whatsappPhone.replace(/\D/g, '')}`}
                    className="mt-0.5 tabular text-sm text-text-muted hover:text-ink underline underline-offset-2"
                    dir="ltr"
                  >
                    {phoneFormatted}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-fib-2 rounded-[24px] bg-surface-soft p-fib-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink">
                  <span className="text-ink">⏰</span>
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-ink">Horaires</p>
                  <p className="mt-0.5 text-sm text-text-muted">
                    7j/7 · 9h – 21h
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-fib-2 rounded-[24px] bg-surface-soft p-fib-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink">
                  <span className="text-ink">📍</span>
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-ink">Livraison</p>
                  <p className="mt-0.5 text-sm text-text-muted">
                    Tout le Maroc · {settings.deliveryFee} MAD
                    {settings.freeDeliveryMinItems > 0 && ` · offerte dès ${settings.freeDeliveryMinItems} pièces`}
                    {' '}· 24–48h · paiement à la réception
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
              Prête à commander ?
            </h2>
            <p className="mt-fib-1 max-w-lg text-sm text-white/70">
              Choisissez vos pièces et envoyez-nous la commande — on s&apos;occupe du
              reste, jusqu&apos;à votre porte.
            </p>
            <a
              href={whatsappMessage}
              target="_blank"
              rel="noreferrer"
              className="press mt-fib-3 inline-flex items-center gap-2 rounded-full bg-white px-fib-3 py-fib-1 text-sm font-medium text-primary hover:bg-white/90"
            >
              <MessageCircle size={15} />
              Commander sur WhatsApp
            </a>
          </div>
        </section>
      </ScrollReveal>
    </div>
  )
}
