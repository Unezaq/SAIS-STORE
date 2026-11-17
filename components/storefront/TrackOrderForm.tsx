'use client'

import { useState } from 'react'
import { PackageSearch } from 'lucide-react'
import { trackOrderAction, type TrackedOrder } from '@/actions/checkout'
import { OrderTrackingCard } from '@/components/storefront/OrderTrackingCard'
import { Button } from '@/components/ui/Button'

const fieldClassName =
  'w-full rounded-xl border border-hairline bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10'
const labelClassName = 'grid gap-1.5 text-sm font-medium text-ink'

export function TrackOrderForm({ whatsappPhone }: { whatsappPhone: string }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [order, setOrder] = useState<TrackedOrder | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    setOrder(null)

    try {
      const result = await trackOrderAction(new FormData(event.currentTarget))
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOrder(result.order)
    } catch {
      setError('Impossible de vérifier la commande pour le moment. Réessayez dans un instant.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-fib-3">
      <form
        onSubmit={handleSubmit}
        className="rounded-[24px] bg-white p-fib-4 shadow-sm ring-1 ring-hairline"
      >
        <h2 className="text-heading text-ink">Retrouver ma commande</h2>
        <p className="mt-1 text-sm text-text-muted">
          Utilisez le numéro de téléphone saisi à la commande et sa référence (SAIS-…). Aucun
          compte n’est nécessaire.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={labelClassName}>
            Téléphone
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="06 12 34 56 78"
              required
              maxLength={18}
              className={fieldClassName}
            />
          </label>
          <label className={labelClassName}>
            Référence de commande
            <input
              name="reference"
              placeholder="SAIS-3F8A21C9"
              required
              maxLength={64}
              autoCapitalize="characters"
              className={`${fieldClassName} font-mono uppercase`}
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        <Button type="submit" className="mt-4" isLoading={pending} disabled={pending}>
          {pending ? 'Recherche…' : 'Afficher ma commande'}
        </Button>
      </form>

      {order && <OrderTrackingCard order={order} whatsappPhone={whatsappPhone} />}

      {!order && !pending && (
        <div className="flex items-start gap-3 rounded-[20px] bg-surface-soft p-4 text-sm text-text-muted">
          <PackageSearch size={18} className="mt-0.5 shrink-0 text-ink" />
          <p>
            Vous avez perdu votre référence ? Elle se trouve dans le message de confirmation et
            sur la page affichée juste après la commande. Sinon, écrivez-nous sur WhatsApp avec
            votre numéro.
          </p>
        </div>
      )}
    </div>
  )
}
