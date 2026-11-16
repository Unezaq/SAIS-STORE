import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { OrderStatusBadge } from '@/components/storefront/OrderStatusBadge'
import { OrderTimeline } from '@/components/storefront/OrderTimeline'
import { getSettings } from '@/lib/products'
import { orderReference } from '@/lib/orderStatus'
import { formatMoroccanPhone, whatsappNumber } from '@/lib/phone'
import { getOrderForCustomerOrLegacy } from '@/lib/store'
import { getCustomerFromSession } from '@/lib/auth/current-customer'
import { formatMAD } from '@/lib/utils'

export default async function AccountOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const customer = await getCustomerFromSession()
  if (!customer) {
    redirect(`/login?next=${encodeURIComponent(`/account/orders/${id}`)}`)
  }

  const [order, settings] = await Promise.all([
    getOrderForCustomerOrLegacy(id, customer.id, null),
    getSettings(),
  ])
  if (!order) notFound()

  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="mx-auto w-full max-w-4xl px-fib-3 pt-fib-4 md:px-fib-4 md:pt-fib-5">
      <Link href="/account/orders" className="text-xs font-medium text-text-muted hover:text-ink">
        ← Retour à mes commandes
      </Link>

      <header className="mt-fib-2 mb-fib-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-eyebrow uppercase text-text-muted">Commande</p>
          <h1 className="mt-1 font-mono text-title text-ink">{orderReference(order.id)}</h1>
          <p className="mt-1 text-sm text-text-muted">
            Passée le {new Date(order.createdAt).toLocaleDateString('fr-MA')} · {itemCount}{' '}
            article{itemCount > 1 ? 's' : ''}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </header>

      <div className="rounded-[24px] bg-white p-fib-4 shadow-sm ring-1 ring-hairline">
        <OrderTimeline status={order.status} />
      </div>

      <div className="mt-fib-3 grid gap-fib-3 md:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[24px] bg-white p-fib-4 shadow-sm ring-1 ring-hairline">
          <h2 className="text-heading text-ink">Articles</h2>
          <ul className="mt-3 divide-y divide-hairline">
            {order.items.map((item, index) => (
              <li
                key={`${item.slug}-${item.size ?? ''}-${item.color ?? ''}-${index}`}
                className="flex justify-between gap-4 py-3 text-sm"
              >
                <span className="min-w-0 text-text-muted">
                  <Link
                    href={`/products/${item.slug}`}
                    className="block truncate font-medium text-ink hover:underline"
                  >
                    {item.title}
                  </Link>
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

          <div className="mt-3 space-y-1.5 border-t border-hairline pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Sous-total</span>
              <span className="text-ink">{formatMAD(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Livraison</span>
              <span className="text-ink">
                {order.deliveryFee === 0 ? 'Gratuite' : formatMAD(order.deliveryFee)}
              </span>
            </div>
            <div className="flex justify-between border-t border-hairline pt-2 font-semibold">
              <span className="text-ink">Total payé à la livraison</span>
              <span className="text-ink">{formatMAD(order.total)}</span>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-fib-2">
          <div className="rounded-[24px] bg-white p-fib-4 shadow-sm ring-1 ring-hairline">
            <h2 className="text-heading text-ink">Livraison</h2>
            <p className="mt-2 text-sm font-medium text-ink">{order.customerName}</p>
            <p className="mt-0.5 text-sm text-text-muted">{formatMoroccanPhone(order.phone)}</p>
            <p className="mt-1 text-sm leading-relaxed text-text-muted">{order.address}</p>
            {order.note && (
              <p className="mt-2 rounded-xl bg-surface-soft p-3 text-xs text-text-muted">
                <span className="font-medium text-ink">Note : </span>
                {order.note}
              </p>
            )}
          </div>

          <a
            href={`https://wa.me/${whatsappNumber(settings.whatsappPhone)}?text=${encodeURIComponent(
              `Bonjour SAIS, ma commande ${orderReference(order.id)} : j’ai une question.`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="press inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-ink/90"
          >
            <MessageCircle size={15} />
            Contacter SAIS
          </a>
        </section>
      </div>
    </div>
  )
}
