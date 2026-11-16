import type { Metadata } from 'next'
import Link from 'next/link'
import {
  MessageCircle,
  ShoppingBag,
  ClipboardCheck,
  Truck,
  Phone,
  Clock,
  MapPin,
  PackageSearch,
} from 'lucide-react'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { JsonLd, faqJsonLd, breadcrumbJsonLd } from '@/lib/seo'
import { getSettings } from '@/lib/products'

export const metadata: Metadata = {
  title: 'Espace client — Commander, suivre et nous contacter',
  description:
    'Comment commander chez SAIS Store en 4 étapes simples : choisissez vos pièces, validez votre panier, confirmez par téléphone, recevez en 24–48h avec paiement à la livraison. Suivi en ligne inclus.',
  alternates: { canonical: '/espace-client' },
}

const steps = [
  {
    icon: ShoppingBag,
    title: 'Choisissez vos pièces',
    body: 'Parcourez la boutique, choisissez votre taille et votre coloris, puis ajoutez vos pièces au panier.',
    action: { label: 'Aller à la boutique', href: '/boutique' },
  },
  {
    icon: ClipboardCheck,
    title: 'Validez votre commande',
    body: 'Nom, téléphone et adresse en deux étapes, avec une confirmation claire avant l’envoi. Aucun compte à créer.',
    action: { label: 'Finaliser ma commande', href: '/checkout' },
  },
  {
    icon: MessageCircle,
    title: 'Confirmez avec nous',
    body: 'Nous vous appelons pour vérifier l’adresse. Votre référence SAIS-… reste disponible pour suivre la commande à tout moment.',
    action: { label: 'Suivre ma commande', href: '/suivre' },
  },
  {
    icon: Truck,
    title: 'Recevez et payez à la livraison',
    body: 'Livraison en 24–48h partout au Maroc. Vous réglez en espèces à la réception, après vérification de la pièce.',
  },
]

const faqs = [
  {
    question: 'Comment passer une commande ?',
    answer:
      "Choisissez vos pièces, ajoutez-les au panier et validez vos coordonnées en deux étapes. Vous recevez immédiatement une référence SAIS-… puis nous vous appelons pour confirmer. Aucun compte n'est nécessaire.",
  },
  {
    question: 'Combien coûte la livraison et sous quel délai ?',
    answer:
      'La livraison est disponible partout au Maroc sous 24 à 48h ouvrées. Le montant exact vous est confirmé sur WhatsApp avec votre commande.',
  },
  {
    question: 'Comment puis-je payer ?',
    answer:
      'Le paiement se fait en espèces à la livraison. Vous réglez uniquement quand vous recevez la pièce et après l’avoir vérifiée.',
  },
  {
    question: 'Puis-je échanger ou retourner une pièce ?',
    answer:
      'Oui, un échange est possible si la pièce ne convient pas : contactez-nous sur WhatsApp dans les 48h suivant la réception, la pièce étant non portée avec son emballage.',
  },
  {
    question: 'Comment suivre ma commande ?',
    answer:
      'Ouvrez la page « Suivre ma commande », saisissez le téléphone utilisé et la référence SAIS-… reçue à la commande : le statut et le récapitulatif s’affichent immédiatement.',
  },
  {
    question: 'Quels sont vos horaires ?',
    answer:
      'Nous répondons sur WhatsApp 7 jours sur 7, de 9h à 21h. Les commandes passées la nuit sont traitées dès le matin.',
  },
]

export default async function EspaceClientPage() {
  const settings = await getSettings()
  const whatsappLink = `https://wa.me/${settings.whatsappPhone}`
  const whatsappOrderLink = `${whatsappLink}?text=${encodeURIComponent(
    'Salam SAIS Store 👋 Bghit ncommandi une pièce. Had la référence li 3jbani :'
  )}`

  return (
    <div className="flex flex-col">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          { name: 'Espace client', path: '/espace-client' },
        ])}
      />
      <JsonLd data={faqJsonLd(faqs)} />

      {/* Header */}
      <ScrollReveal variant="fade-up">
        <header className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-4 md:px-fib-4 md:pt-fib-6">
          <p className="text-eyebrow uppercase text-text-muted">Espace client</p>
          <h1 className="mt-fib-2 text-title text-ink [text-wrap:balance]">
            Commander chez SAIS, en toute simplicité.
          </h1>
          <p className="mt-fib-2 max-w-xl text-sm leading-relaxed text-text-muted md:text-[15px]">
            Quatre étapes, aucun compte à créer. Commande, suivi et contact —
            tout est ici.
          </p>
        </header>
      </ScrollReveal>

      {/* Steps */}
      <section className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-4 md:px-fib-4">
        <ScrollReveal variant="fade-up">
          <div className="grid gap-fib-2 md:grid-cols-4 md:gap-fib-3">
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <div
                  key={step.title}
                  className="flex h-full flex-col rounded-[24px] bg-surface-soft p-fib-3 md:p-fib-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white">
                      <Icon size={17} strokeWidth={1.8} />
                    </span>
                    <span className="tabular text-xs font-medium text-text-muted">
                      0{index + 1}
                    </span>
                  </div>
                  <div className="mt-fib-3 flex flex-1 flex-col">
                    <h2 className="text-heading text-ink">{step.title}</h2>
                    <p className="mt-fib-1 flex-1 text-sm leading-relaxed text-text-muted">
                      {step.body}
                    </p>
                    {step.action && (
                      <Link
                        href={step.action.href ?? whatsappOrderLink}
                        className="press mt-fib-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-ink px-fib-2 py-fib-1 text-[13px] font-medium text-white transition-colors hover:bg-ink/90"
                      >
                        {step.action.label}
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollReveal>
      </section>

      {/* Contact + tracking */}
      <section className="mx-auto w-full max-w-7xl px-fib-3 py-fib-4 md:px-fib-4 md:py-fib-5">
        <ScrollReveal variant="fade-up" delay={0.05}>
          <div className="grid gap-fib-2 md:grid-cols-12 md:gap-fib-3">
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
                  href={whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="press inline-flex items-center gap-2 rounded-full bg-white px-fib-3 py-fib-1 text-sm font-medium text-primary hover:bg-white/90"
                >
                  <MessageCircle size={15} />
                  Ouvrir WhatsApp
                </a>
                <Link
                  href="/promotions"
                  className="press inline-flex items-center gap-2 rounded-full bg-white/10 px-fib-3 py-fib-1 text-sm font-medium text-white backdrop-blur-md hover:bg-white/15"
                >
                  Voir les promotions
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
                  <p className="mt-0.5 tabular text-sm text-text-muted" dir="ltr">
                    +{settings.whatsappPhone.replace(
                      /^(\d{3})(\d{3})(\d{3})(\d{3})$/,
                      '$1 $2 $3 $4'
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-fib-2 rounded-[24px] bg-surface-soft p-fib-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink">
                  <Clock size={17} strokeWidth={1.8} />
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
                  <MapPin size={17} strokeWidth={1.8} />
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
        </ScrollReveal>
      </section>

      {/* Order tracking */}
      <section className="mx-auto w-full max-w-7xl px-fib-3 md:px-fib-4">
        <ScrollReveal variant="fade-up" delay={0.05}>
          <Link
            href="/suivre"
            className="group flex items-center justify-between gap-fib-3 rounded-[24px] bg-surface-soft p-fib-4 transition-colors hover:bg-ink/[0.04] md:p-fib-4"
          >
            <div className="flex items-center gap-fib-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-white">
                <PackageSearch size={17} strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="text-heading text-ink">Suivre ma commande</h2>
                <p className="mt-0.5 text-sm text-text-muted">
                  Avec votre téléphone et votre référence SAIS-…, le statut et le
                  récapitulatif s’affichent immédiatement.
                </p>
              </div>
            </div>
            <svg
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              className="shrink-0 text-ink transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </ScrollReveal>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-7xl px-fib-3 py-fib-4 md:px-fib-4 md:py-fib-5">
        <ScrollReveal variant="fade-up">
          <div className="max-w-2xl">
            <p className="text-eyebrow uppercase text-text-muted">FAQ</p>
            <h2 className="mt-fib-1 text-title text-ink">Les questions les plus posées.</h2>
          </div>
        </ScrollReveal>
        <ScrollReveal variant="fade-up" delay={0.05}>
          <div className="mt-fib-3 grid gap-fib-2 md:grid-cols-2">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-[20px] bg-surface-soft px-fib-3 py-fib-2 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-fib-2 text-[14px] font-medium text-ink">
                  {faq.question}
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink transition-transform duration-200 group-open:rotate-45">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" d="M6 1v10M1 6h10" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-fib-1 text-sm leading-relaxed text-text-muted">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </ScrollReveal>
      </section>

      {/* Final CTA */}
      <section className="mx-auto w-full max-w-7xl px-fib-3 pb-fib-6 md:px-fib-4 md:pb-fib-7">
        <ScrollReveal variant="fade-up">
          <div className="rounded-[28px] bg-primary px-fib-4 py-fib-5 text-white md:px-fib-5 md:py-fib-6">
            <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] md:text-[26px]">
              Prête à commander ?
            </h2>
            <p className="mt-fib-1 max-w-lg text-sm text-white/70">
              Choisissez vos pièces et envoyez-nous la commande — on s&apos;occupe du
              reste, jusqu&apos;à votre porte.
            </p>
            <a
              href={whatsappOrderLink}
              target="_blank"
              rel="noreferrer"
              className="press mt-fib-3 inline-flex items-center gap-2 rounded-full bg-white px-fib-3 py-fib-1 text-sm font-medium text-primary hover:bg-white/90"
            >
              <MessageCircle size={15} />
              Commander sur WhatsApp
            </a>
          </div>
        </ScrollReveal>
      </section>
    </div>
  )
}
