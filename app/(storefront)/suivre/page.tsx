import type { Metadata } from 'next'
import Link from 'next/link'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { TrackOrderForm } from '@/components/storefront/TrackOrderForm'
import { getSettings } from '@/lib/products'

export const metadata: Metadata = {
  title: 'Suivre ma commande',
  description:
    'Suivez votre commande SAIS avec votre numéro de téléphone et votre référence : préparation, expédition et livraison en 24–48h partout au Maroc.',
  alternates: { canonical: '/suivre' },
  robots: { index: true, follow: true },
}

export default async function TrackOrderPage() {
  const settings = await getSettings()

  return (
    <div className="mx-auto w-full max-w-3xl px-fib-3 pt-fib-4 md:px-fib-4 md:pt-fib-5">
      <ScrollReveal variant="fade-up">
        <header className="mb-fib-4">
          <p className="text-eyebrow uppercase text-text-muted">Suivi de commande</p>
          <h1 className="mt-fib-1 text-title text-ink">Où est ma commande ?</h1>
          <p className="mt-fib-2 max-w-xl text-sm leading-relaxed text-text-muted md:text-[15px]">
            Entrez le téléphone utilisé lors de la commande et sa référence pour voir son statut
            en temps réel — sans créer de compte.
          </p>
        </header>
      </ScrollReveal>

      <ScrollReveal variant="fade-up" delay={0.05}>
        <TrackOrderForm whatsappPhone={settings.whatsappPhone} />
      </ScrollReveal>

      <p className="mt-fib-4 text-sm text-text-muted">
        Vous avez un compte ?{' '}
        <Link href="/account" className="font-medium text-ink hover:underline">
          Retrouvez toutes vos commandes dans votre espace client
        </Link>
        .
      </p>
    </div>
  )
}
