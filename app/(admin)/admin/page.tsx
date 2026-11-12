import Link from 'next/link'
import { getProducts, getOrders, getClients } from '@/lib/products'
import { Package, ShoppingCart, Users, TrendingUp } from 'lucide-react'

export default async function AdminDashboard() {
  const [products, orders, clients] = await Promise.all([
    getProducts(),
    getOrders(),
    getClients(),
  ])
  const revenue = orders.reduce((sum, o) => sum + o.total, 0)
  const pendingOrders = orders.filter((o) => o.status === 'en_attente').length

  const stats = [
    { label: 'Produits', value: products.length, icon: Package },
    { label: 'Commandes', value: orders.length, icon: ShoppingCart },
    { label: 'Clients', value: clients.length, icon: Users },
    { label: 'Chiffre d\u2019affaires (MAD)', value: revenue, icon: TrendingUp },
  ]

  return (
    <div className="flex flex-col gap-fib-4">
      <div>
        <p className="text-eyebrow uppercase text-text-muted">Tableau de bord</p>
        <h1 className="mt-fib-1 text-title text-ink">Vue d&apos;ensemble</h1>
      </div>

      <div className="grid gap-fib-3 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline">
              <div className="flex items-center justify-between">
                <p className="text-eyebrow uppercase text-text-muted">{s.label}</p>
                <Icon size={17} className="text-text-muted" />
              </div>
              <p className="mt-fib-2 text-[28px] font-semibold tabular text-ink">{s.value}</p>
            </div>
          )
        })}
      </div>

      <div className="grid gap-fib-3 lg:grid-cols-2">
        <div className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline">
          <h2 className="text-heading text-ink">Commandes en attente</h2>
          <p className="mt-1 text-sm text-text-muted">
            {pendingOrders} commande{pendingOrders > 1 ? 's' : ''} à confirmer.
          </p>
          <Link href="/admin/orders" className="press mt-fib-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink">
            Voir les commandes →
          </Link>
        </div>
        <div className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline">
          <h2 className="text-heading text-ink">Catalogue</h2>
          <p className="mt-1 text-sm text-text-muted">
            {products.length} produits actifs. Gérez le stock, les prix et les coloris.
          </p>
          <Link href="/admin/products" className="press mt-fib-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink">
            Gérer les produits →
          </Link>
        </div>
      </div>
    </div>
  )
}
