import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, MessageCircle, Phone, Printer, Truck } from 'lucide-react'
import { OrderStatusSelect } from '@/components/admin/OrderStatusSelect'
import { OrderStatusBadge } from '@/components/storefront/OrderStatusBadge'
import { OrderTimeline } from '@/components/storefront/OrderTimeline'
import { getSettings } from '@/lib/products'
import { orderReference } from '@/lib/orderStatus'
import { formatMoroccanPhone, whatsappNumber } from '@/lib/phone'
import { getOrderById } from '@/lib/store'
import { formatMAD } from '@/lib/utils'

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [order, settings] = await Promise.all([getOrderById(id), getSettings()])
  if (!order) notFound()

  const reference = orderReference(order.id)
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
  const whatsappText = encodeURIComponent(
    `Bonjour ${order.customerName}, c’est SAIS Store. Je vous contacte au sujet de votre commande ${reference} (${formatMAD(order.total)}), livraison à l’adresse indiquée. Confirmez-vous la commande ?`
  )

  return (
    <div className="flex flex-col gap-fib-4">
      <div>
        <Link href="/admin/orders" className="text-xs font-medium text-text-muted hover:text-ink">
          ← Toutes les commandes
        </Link>
        <div className="mt-fib-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-eyebrow uppercase text-text-muted">Commande</p>
            <h1 className="mt-1 font-mono text-title text-ink">{reference}</h1>
            <p className="mt-1 text-sm text-text-muted">
              {new Date(order.createdAt).toLocaleDateString('fr-MA', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}{' '}
              · {itemCount} article{itemCount > 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <OrderStatusBadge status={order.status} />
            <OrderStatusSelect orderId={order.id} currentStatus={order.status} />
          </div>
          {order.trackingToken && (
            <div className="flex flex-col items-end gap-0.5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
                Lien de suivi
              </p>
              <p className="text-xs font-mono text-text-muted break-all">
                {`${process.env.NEXT_PUBLIC_SITE_URL}/suivre/${order.trackingToken}`}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-fib-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="flex flex-col gap-fib-3">
          <section className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline">
            <h2 className="text-heading text-ink">Articles commandés</h2>
            <ul className="mt-3 divide-y divide-hairline">
              {order.items.map((item, index) => (
                <li
                  key={`${item.slug}-${item.size ?? ''}-${item.color ?? ''}-${index}`}
                  className="flex items-start justify-between gap-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/products/${item.slug}`}
                      className="font-medium text-ink hover:underline"
                    >
                      {item.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {[item.color, item.size].filter(Boolean).join(' · ') || 'Sans variante'} ·
                      Qté {item.quantity} · {formatMAD(item.price)} l’unité
                    </p>
                  </div>
                  <span className="shrink-0 font-medium tabular text-ink">
                    {formatMAD(item.price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3 space-y-1.5 border-t border-hairline pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Sous-total</span>
                <span className="text-ink">{formatMAD(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Livraison</span>
                <span className="text-ink">
                  {order.deliveryFee === 0 ? 'Offerte' : formatMAD(order.deliveryFee)}
                </span>
              </div>
              <div className="flex justify-between border-t border-hairline pt-2 font-semibold">
                <span className="text-ink">Total à encaisser</span>
                <span className="text-ink">{formatMAD(order.total)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline">
            <h2 className="text-heading text-ink">Étapes</h2>
            <div className="mt-3">
              <OrderTimeline status={order.status} />
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-fib-3">
          <section className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline">
            <h2 className="text-heading text-ink">Cliente</h2>
            <p className="mt-2 text-sm font-medium text-ink">{order.customerName}</p>
            <a
              href={`tel:${order.phone}`}
              className="mt-1 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-ink"
            >
              <Phone size={13} /> {formatMoroccanPhone(order.phone)}
            </a>
            {order.clientEmail && (
              <p className="mt-1 text-sm text-text-muted">{order.clientEmail}</p>
            )}
            <p className="mt-3 text-[11px] uppercase tracking-[0.12em] text-text-muted">
              Adresse de livraison
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink">{order.address}</p>
            {order.note && (
              <p className="mt-3 rounded-xl bg-surface-soft p-3 text-xs leading-relaxed text-text-muted">
                <span className="font-medium text-ink">Note de la cliente : </span>
                {order.note}
              </p>
            )}
          </section>

          <section className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline">
            <h2 className="text-heading text-ink">Contacter</h2>
            <div className="mt-2 flex flex-col gap-2">
              <a
                href={`https://wa.me/${whatsappNumber(order.phone)}?text=${whatsappText}`}
                target="_blank"
                rel="noreferrer"
                className="press inline-flex h-10 items-center justify-center gap-2 rounded-full bg-whatsapp px-4 text-sm font-medium text-white hover:opacity-90"
              >
                <MessageCircle size={15} />
                WhatsApp — confirmer la commande
              </a>
              <a
                href={`tel:${order.phone}`}
                className="press inline-flex h-10 items-center justify-center gap-2 rounded-full border border-hairline px-4 text-sm font-medium text-ink hover:bg-surface-soft"
              >
                <Phone size={15} />
                Appeler la cliente
              </a>
              <a
                href={`https://wa.me/${whatsappNumber(settings.whatsappPhone)}?text=${encodeURIComponent(
                  `Commande ${reference} : mise à jour à faire.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="text-center text-xs text-text-muted hover:text-ink"
              >
                Envoyer un message à l’équipe
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
