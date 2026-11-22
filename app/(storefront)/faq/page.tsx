import type { Metadata } from 'next'
import Link from 'next/link'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { getSettings } from '@/lib/products'

export const metadata: Metadata = {
  title: 'FAQ — Questions fréquentes | SAIS Store',
  description:
    'Toutes les réponses sur la commande, la livraison, le paiement et le retour chez SAIS Store Kenitra. Paiement à la livraison partout au Maroc.',
  alternates: { canonical: '/faq' },
}

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

export default async function FAQPage() {
  const settings = await getSettings()
  const whatsappLink = `https://wa.me/${settings.whatsappPhone}`

  return (
    <div className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-4 md:px-fib-4 md:pt-fib-6">
      <ScrollReveal variant="fade-up">
        <header className="mb-fib-4 max-w-2xl md:mb-fib-5">
          <p className="text-eyebrow uppercase text-text-muted">FAQ</p>
          <h1 className="mt-fib-1 text-title text-ink [text-wrap:balance]">
            Les questions les plus posées.
          </h1>
          <p className="mt-fib-2 max-w-xl text-sm leading-relaxed text-text-muted md:text-[15px]">
            Commande, livraison, paiement, retour et suivi — tout ce qu’il faut
            savoir pour commander chez SAIS.
          </p>
        </header>
      </ScrollReveal>

      <ScrollReveal variant="fade-up" delay={0.05}>
        <div className="mx-auto w-full max-w-2xl mt-fib-4 grid gap-fib-2 md:grid-cols-2">
          {faqs.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-[20px] bg-surface-soft px-fib-3 py-fib-2 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-fib-2 text-[14px] font-medium text-ink">
                {faq.question}
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink transition-transform duration-200 group-open:rotate-45">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
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

      <ScrollReveal variant="fade-up">
        <section className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-6 pb-fib-6 md:px-fib-4 md:pt-fib-7 md:pb-fib-8">
          <div className="rounded-[28px] bg-primary px-fib-4 py-fib-5 text-white md:px-fib-5 md:py-fib-6">
            <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] md:text-[26px]">
              Une question sans réponse ?
            </h2>
            <p className="mt-fib-1 max-w-lg text-sm text-white/70">
              Une conseillère répond sur WhatsApp en quelques minutes — tailles,
              coloris et disponibilité.
            </p>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="press mt-fib-3 inline-flex items-center gap-2 rounded-full bg-white px-fib-3 py-fib-1 text-sm font-medium text-primary hover:bg-white/90"
            >
              Écrire sur WhatsApp
            </a>
          </div>
        </section>
      </ScrollReveal>
    </div>
  )
}
