import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Package } from 'lucide-react'
import { getCustomerFromSession } from '@/lib/auth/current-customer'
import { getOrdersByCustomerId } from '@/lib/store'
import { OrderStatusBadge } from '@/components/storefront/OrderStatusBadge'
import { orderReference } from '@/lib/orderStatus'
import { formatMAD } from '@/lib/utils'
import type { StoreOrder } from '@/lib/types/store'

export default async function OrdersPage() {
  const customer = await getCustomerFromSession()
  if (!customer) redirect('/login?next=%2Faccount/orders')

  const orders = await getOrdersByCustomerId(customer.id)

  return (
    <div className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-4 md:px-fib-4 md:pt-fib-5">
      <Link
        href="/account"
        className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-ink mb-fib-4"
      >
        ← Retour à mon compte
      </Link>

      <h1 className="text-title text-ink mb-fib-4">Mes commandes</h1>

      {orders.length === 0 ? (
        <section className="rounded-[24px] bg-white p-fib-6 text-center shadow-sm ring-1 ring-hairline">
          <Package className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <h2 className="text-heading text-ink mb-2">Aucune commande pour le moment.</h2>
          <p className="text-sm text-text-muted mb-fib-4">
            Votre historique de commande apparaîtra ici après votre premier achat.
          </p>
          <Link
            href="/boutique"
            className="press inline-flex items-center gap-2 rounded-full bg-ink px-fib-3 py-fib-1 text-sm font-medium text-white hover:bg-ink/90"
          >
            Voir la boutique →
          </Link>
        </section>
      ) : (
        <ul className="divide-y divide-hairline">
          {orders.map((order) => (
            <li key={order.id} className="px-0 py-fib-4 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href={`/account/orders/${order.id}`}
                className="block sm:min-w-0"
              >
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono text-[13px] font-semibold text-ink">
                    {orderReference(order.id)}
                  </span>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="text-xs text-text-muted">
                  {new Date(order.createdAt).toLocaleDateString('fr-MA')} ·{' '}
                  {order.items.reduce((sum, item) => sum + item.quantity, 0)} article
                  {order.items.reduce((sum, item) => sum + item.quantity, 0) > 1 ? 's' : ''}
                </p>
                <p className="text-sm text-text-muted truncate max-w-md">
                  {order.items.map((item) => item.title).join(' · ')}
                </p>
              </Link>
              <div className="mt-2 sm:mt-0 text-right">
                <span className="font-semibold tabular text-ink">
                  {formatMAD(order.total)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
