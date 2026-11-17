import type { Metadata } from 'next'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { trackOrderByToken } from '@/actions/checkout'
import { OrderTrackingCard } from '@/components/storefront/OrderTrackingCard'
import { getSettings } from '@/lib/products'
import { whatsappNumber } from '@/lib/phone'

export const metadata: Metadata = {
  title: 'Suivi de commande',
  description: 'Suivez votre commande SAIS : préparation, expédition et livraison.',
  robots: { index: false, follow: false },
}

/**
 * Token link sent by the store (no phone number needed). Unguessable UUID
 * stored on the order, resolved server-side with the service role.
 */
export default async function TrackOrderByTokenPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const [result, settings] = await Promise.all([trackOrderByToken(token), getSettings()])

  return (
    <div className="mx-auto w-full max-w-3xl px-fib-3 pt-fib-4 md:px-fib-4 md:pt-fib-5">
      <header className="mb-fib-4">
        <p className="text-eyebrow uppercase text-text-muted">Suivi de commande</p>
        <h1 className="mt-fib-1 text-title text-ink">Votre commande SAIS</h1>
        <p className="mt-fib-2 max-w-xl text-sm leading-relaxed text-text-muted md:text-[15px]">
          Statut, articles et adresse de livraison — mis à jour par notre équipe.
        </p>
      </header>

      {result.ok ? (
        <OrderTrackingCard order={result.order} whatsappPhone={settings.whatsappPhone} />
      ) : (
        <section className="rounded-[24px] bg-white p-fib-4 shadow-sm ring-1 ring-hairline">
          <h2 className="text-heading text-ink">Lien de suivi introuvable</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            Ce lien n’est plus valide. Vous pouvez retrouver votre commande avec votre numéro de
            téléphone et sa référence, ou nous écrire sur WhatsApp.
          </p>
          <div className="mt-fib-3 flex flex-wrap gap-2">
            <Link
              href="/suivre"
              className="press inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-ink/90"
            >
              Suivre avec ma référence
            </Link>
            <a
              href={`https://wa.me/${whatsappNumber(settings.whatsappPhone)}?text=${encodeURIComponent(
                'Bonjour SAIS, je souhaite suivre ma commande.'
              )}`}
              target="_blank"
              rel="noreferrer"
              className="press inline-flex h-11 items-center justify-center gap-2 rounded-full border border-hairline px-5 text-sm font-medium text-ink hover:bg-surface-soft"
            >
              <MessageCircle size={15} />
              Écrire sur WhatsApp
            </a>
          </div>
        </section>
      )}

      <p className="mt-fib-4 text-sm text-text-muted">
        <Link href="/suivre" className="font-medium text-ink hover:underline">
          Suivre une autre commande
        </Link>
      </p>
    </div>
  )
}
