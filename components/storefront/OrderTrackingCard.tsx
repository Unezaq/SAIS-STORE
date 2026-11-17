import { MessageCircle } from 'lucide-react'
import type { TrackedOrder } from '@/actions/checkout'
import { OrderStatusBadge } from '@/components/storefront/OrderStatusBadge'
import { OrderTimeline } from '@/components/storefront/OrderTimeline'
import { formatMoroccanPhone, whatsappNumber } from '@/lib/phone'
import { formatMAD } from '@/lib/utils'

/**
 * The read-only order summary shared by the two public tracking entry points:
 * /suivre (phone + reference) and /suivre/[token] (the link the admin sends).
 */
export function OrderTrackingCard({
  order,
  whatsappPhone,
}: {
  order: TrackedOrder
  whatsappPhone: string
}) {
  return (
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
                {[item.color, item.size].filter(Boolean).join(' · ') || 'Sans variante'} · Qté{' '}
                {item.quantity}
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
          <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Livraison</p>
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
  )
}
