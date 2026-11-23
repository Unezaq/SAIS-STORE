import Link from 'next/link'
import { getProducts, getOrders, getAdminClients } from '@/lib/products'
import { OrderStatusBadge } from '@/components/storefront/OrderStatusBadge'
import { orderReference } from '@/lib/orderStatus'
import { Package, ShoppingCart, Users, TrendingUp, ShieldAlert } from 'lucide-react'
import { summarizeRisks } from '@/lib/risk'
import { formatMAD } from '@/lib/utils'

export default async function AdminDashboard() {
  const [products, orders, clients] = await Promise.all([
    getProducts(),
    getOrders(),
    getAdminClients(),
  ])

  // Cancelled orders never reached the customer, so they are not revenue.
  const paidOrders = orders.filter((order) => order.status !== 'annulee')
  const revenue = paidOrders.reduce((sum, order) => sum + order.total, 0)
  const averageBasket = paidOrders.length > 0 ? Math.round(revenue / paidOrders.length) : 0
  const pendingOrders = orders.filter((order) => order.status === 'en_attente').length
  const recentOrders = orders.slice(0, 5)
  const openOrders = orders.filter(
    (order) => order.status === 'en_attente' || order.status === 'confirmee'
  )
  const risks = summarizeRisks(openOrders, orders)
  const totalDiscount = paidOrders.reduce(
    (sum, order) => sum + Math.max(0, order.subtotal + order.deliveryFee - order.total),
    0
  )

  const stats = [
    { label: 'Produits', value: String(products.length), icon: Package },
    { label: 'Commandes', value: String(orders.length), icon: ShoppingCart },
    { label: 'Clientes', value: String(clients.length), icon: Users },
    { label: 'Chiffre d’affaires', value: formatMAD(revenue), icon: TrendingUp },
  ]

  return (
    <div className="flex flex-col gap-fib-4">
      <div>
        <p className="text-eyebrow uppercase text-text-muted">Tableau de bord</p>
        <h1 className="mt-fib-1 text-title text-ink">Vue d’ensemble</h1>
        <p className="mt-fib-1 text-sm text-text-muted">
          {pendingOrders} commande{pendingOrders > 1 ? 's' : ''} à confirmer · panier moyen{' '}
          {formatMAD(averageBasket)}.
        </p>
      </div>

      <div className="grid gap-fib-3 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline"
            >
              <div className="flex items-center justify-between">
                <p className="text-eyebrow uppercase text-text-muted">{stat.label}</p>
                <Icon size={17} className="text-text-muted" />
              </div>
              <p className="mt-fib-2 text-[26px] font-semibold tabular text-ink">{stat.value}</p>
            </div>
          )
        })}
      </div>

      <div className="grid gap-fib-3 lg:grid-cols-[1.4fr_1fr]">
        <section className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-hairline">
          <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
            <h2 className="text-heading text-ink">Dernières commandes</h2>
            <Link href="/admin/orders" className="text-xs font-medium text-text-muted hover:text-ink">
              Tout voir →
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="p-fib-4 text-center text-sm text-text-muted">
              Aucune commande pour le moment.
            </p>
          ) : (
            <ul className="divide-y divide-hairline">
              {recentOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-surface-soft/60"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-ink">
                        {orderReference(order.id)}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-text-muted">
                        {order.customerName} ·{' '}
                        {new Date(order.createdAt).toLocaleDateString('fr-MA')}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <OrderStatusBadge status={order.status} />
                      <span className="tabular text-xs font-medium text-ink">
                        {formatMAD(order.total)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-fib-2">
          <div className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-heading text-ink">Risque & remises</h2>
              <ShieldAlert size={16} className="text-text-muted" />
            </div>
            <p className="mt-1 text-sm leading-relaxed text-text-muted">
              {risks.counts.eleve} commande{risks.counts.eleve > 1 ? 's' : ''} à risque élevé ·{' '}
              {risks.counts.moyen} à vérifier · {formatMAD(totalDiscount)} de remises accordées.
            </p>
            <Link
              href="/admin/pilotage"
              className="press mt-fib-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink"
            >
              Ouvrir le pilotage →
            </Link>
          </div>
          <div className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline">
            <h2 className="text-heading text-ink">À confirmer</h2>
            <p className="mt-1 text-sm text-text-muted">
              {pendingOrders} commande{pendingOrders > 1 ? 's' : ''} en attente d’appel.
            </p>
            <Link
              href="/admin/orders?status=en_attente"
              className="press mt-fib-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink"
            >
              Appeler les clientes →
            </Link>
          </div>
          <div className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline">
            <h2 className="text-heading text-ink">Catalogue</h2>
            <p className="mt-1 text-sm text-text-muted">
              {products.length} produits actifs. Gérez les prix, coloris et photos.
            </p>
            <Link
              href="/admin/products"
              className="press mt-fib-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink"
            >
              Gérer les produits →
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
