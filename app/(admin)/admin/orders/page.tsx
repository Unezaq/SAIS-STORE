import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { getOrders } from '@/lib/products'
import { whatsappNumber } from '@/lib/phone'
import { OrderStatusSelect } from '@/components/admin/OrderStatusSelect'
import { OrderRiskBadge } from '@/components/admin/OrderRiskBadge'
import { OrderStatusBadge } from '@/components/storefront/OrderStatusBadge'
import { assessOrderRisk } from '@/lib/risk'
import { ORDER_STATUSES, ORDER_STATUS_LABELS, isOrderStatus, orderReference } from '@/lib/orderStatus'
import { formatMAD } from '@/lib/utils'

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status: rawStatus } = await searchParams
  const status = rawStatus && isOrderStatus(rawStatus) ? rawStatus : 'all'
  const orders = await getOrders()
  const filtered = status === 'all' ? orders : orders.filter((order) => order.status === status)
  const risks = new Map(orders.map((order) => [order.id, assessOrderRisk(order, orders)]))
  const pending = orders.filter((order) => order.status === 'en_attente').length

  const filters = [
    { value: 'all', label: `Toutes (${orders.length})` },
    ...ORDER_STATUSES.map((value) => ({
      value,
      label: `${ORDER_STATUS_LABELS[value]} (${orders.filter((order) => order.status === value).length})`,
    })),
  ]

  return (
    <div className="flex flex-col gap-fib-4">
      <div>
        <p className="text-eyebrow uppercase text-text-muted">Ventes</p>
        <h1 className="mt-fib-1 text-title text-ink">Commandes</h1>
        <p className="mt-fib-1 text-sm text-text-muted">
          {orders.length} commande{orders.length > 1 ? 's' : ''} · {pending} en attente de
          confirmation. Ouvrez une commande pour appeler la cliente et changer son statut.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const active = filter.value === status
          return (
            <Link
              key={filter.value}
              href={filter.value === 'all' ? '/admin/orders' : `/admin/orders?status=${filter.value}`}
              className={`press rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
                active
                  ? 'bg-ink text-white ring-ink'
                  : 'bg-white text-text-muted ring-hairline hover:text-ink'
              }`}
            >
              {filter.label}
            </Link>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[20px] bg-white p-fib-4 text-center text-text-muted shadow-sm ring-1 ring-hairline">
          Aucune commande dans ce filtre.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[20px] bg-white shadow-sm ring-1 ring-hairline">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-surface-soft text-left text-[11px] uppercase tracking-[0.12em] text-text-muted">
              <tr>
                <th className="px-4 py-3">Référence</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Articles</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Risque</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {filtered.map((order) => (
                <tr key={order.id} className="hover:bg-surface-soft/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-mono text-xs font-semibold text-ink hover:underline"
                    >
                      {orderReference(order.id)}
                    </Link>
                    {order.note?.startsWith('[WhatsApp]') && (
                      <span className="mt-1 flex w-fit items-center gap-1 rounded-full bg-whatsapp/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#128C4A]">
                        <MessageCircle size={10} /> WhatsApp
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">{order.customerName}</td>
                  <td className="px-4 py-3 tabular text-text-muted">
                    <a href={`tel:${order.phone}`} className="hover:text-ink hover:underline">
                      {order.phone}
                    </a>
                  </td>
                  <td className="max-w-[20rem] whitespace-normal px-4 py-3 text-xs text-text-muted">
                    {order.items
                      .map(
                        (item) =>
                          `${item.title} (${item.color ?? '—'}, ${item.size ?? '—'}) ×${item.quantity}`
                      )
                      .join(' · ')}
                  </td>
                  <td className="px-4 py-3 tabular font-medium text-ink">{formatMAD(order.total)}</td>
                  <td className="px-4 py-3">
                    {order.status === 'annulee' || order.status === 'livree' ? (
                      <span className="text-xs text-text-muted">—</span>
                    ) : (
                      <OrderRiskBadge risk={risks.get(order.id)!} />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      <OrderStatusBadge status={order.status} />
                      <OrderStatusSelect orderId={order.id} currentStatus={order.status} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {new Date(order.createdAt).toLocaleDateString('fr-MA')}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`https://wa.me/${whatsappNumber(order.phone)}?text=${encodeURIComponent(
                          `Bonjour ${order.customerName}, c’est SAIS Store. Votre commande ${orderReference(order.id)} (${formatMAD(order.total)}) est bien reçue. Confirmez-vous la livraison ?`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="press inline-flex h-8 items-center gap-1 rounded-full bg-whatsapp px-2.5 text-[11px] font-semibold text-white hover:opacity-90"
                      >
                        <MessageCircle size={13} /> WhatsApp
                      </a>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="text-xs font-medium text-ink hover:underline"
                      >
                        Détail →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
