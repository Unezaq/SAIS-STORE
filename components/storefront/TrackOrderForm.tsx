'use client'

import { useState } from 'react'
import { MessageCircle, PackageSearch } from 'lucide-react'
import { trackOrderAction, type TrackedOrder } from '@/actions/checkout'
import { OrderStatusBadge } from '@/components/storefront/OrderStatusBadge'
import { OrderTimeline } from '@/components/storefront/OrderTimeline'
import { Button } from '@/components/ui/Button'
import { formatMoroccanPhone, whatsappNumber } from '@/lib/phone'
import { formatMAD } from '@/lib/utils'

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

      {order && (
        <section className="rounded-[24px] bg-white p-fib-4 shadow-sm ring-1 ring-hairline">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-eyebrow uppercase text-text-muted">Commande</p>
              <p className="mt-1 font-mono text-lg font-semibold tracking-wide text-ink">
                {order.reference}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Passée le {new Date(order.createdAt).toLocaleDateString('fr-MA')} ·{' '}
                {formatMoroccanPhone(order.phone)}
              </p>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          <div className="mt-4">
            <OrderTimeline status={order.status} />
          </div>

          <ul className="mt-4 divide-y divide-hairline rounded-2xl bg-surface-soft px-4">
            {order.items.map((item, index) => (
              <li
                key={`${item.slug}-${item.size ?? ''}-${item.color ?? ''}-${index}`}
                className="flex justify-between gap-4 py-3 text-sm"
              >
                <span className="min-w-0 text-text-muted">
                  <span className="block truncate font-medium text-ink">{item.title}</span>
                  <span>
                    {[item.color, item.size].filter(Boolean).join(' · ') || 'Sans variante'} ·
                    Qté {item.quantity}
                  </span>
                </span>
                <span className="shrink-0 font-medium text-ink">
                  {formatMAD(item.price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-2xl border border-hairline p-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
                Livraison
              </p>
              <p className="mt-1 text-ink">{order.customerName}</p>
              <p className="mt-0.5 text-text-muted">{order.address}</p>
            </div>
            <div className="rounded-2xl border border-hairline p-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Total</p>
              <p className="mt-1 text-lg font-semibold text-ink">{formatMAD(order.total)}</p>
              <p className="mt-0.5 text-xs text-text-muted">
                Sous-total {formatMAD(order.subtotal)} · Livraison{' '}
                {order.deliveryFee === 0 ? 'gratuite' : formatMAD(order.deliveryFee)}
              </p>
            </div>
          </div>

          {order.note && (
            <p className="mt-3 rounded-2xl bg-surface-soft p-3 text-xs text-text-muted">
              <span className="font-medium text-ink">Votre note : </span>
              {order.note}
            </p>
          )}

          <a
            href={`https://wa.me/${whatsappNumber(whatsappPhone)}?text=${encodeURIComponent(
              `Bonjour SAIS, je souhaite suivre la commande ${order.reference}.`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="press mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-ink/90"
          >
            <MessageCircle size={15} />
            Poser une question
          </a>
        </section>
      )}

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
