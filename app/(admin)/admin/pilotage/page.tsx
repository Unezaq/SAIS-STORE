import Link from 'next/link'
import {
  AlertTriangle,
  BadgePercent,
  Banknote,
  CheckCircle2,
  MessageCircle,
  Package,
  ShieldAlert,
  ShoppingCart,
  Truck,
} from 'lucide-react'
import { getOrders, getProducts, getSettings } from '@/lib/products'
import { getStorePrice } from '@/lib/pricing'
import { assessOrderRisk, summarizeRisks, RISK_LEVEL_LABELS } from '@/lib/risk'
import { orderReference } from '@/lib/orderStatus'
import { formatMAD } from '@/lib/utils'

const percent = (value: number) => `${Math.round(value * 100)} %`

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

export default async function PilotagePage() {
  const [orders, products, settings] = await Promise.all([
    getOrders(),
    getProducts(),
    getSettings(),
  ])

  const cancelled = orders.filter((order) => order.status === 'annulee')
  const active = orders.filter((order) => order.status !== 'annulee')

  const revenue = active.reduce((sum, order) => sum + order.total, 0)
  const itemRevenue = active.reduce(
    (sum, order) =>
      sum + order.items.reduce((line, item) => line + item.price * item.quantity, 0),
    0
  )
  const itemsSold = active.reduce(
    (sum, order) => sum + order.items.reduce((line, item) => line + item.quantity, 0),
    0
  )
  const discounts = active.map((order) => Math.max(0, order.subtotal + order.deliveryFee - order.total))
  const totalDiscount = discounts.reduce((sum, value) => sum + value, 0)
  const discountedOrders = discounts.filter((value) => value > 0).length
  const discountRate = revenue + totalDiscount > 0 ? totalDiscount / (revenue + totalDiscount) : 0
  const averageBasket = active.length > 0 ? Math.round(revenue / active.length) : 0
  const averageUnitPrice = itemsSold > 0 ? Math.round(itemRevenue / itemsSold) : 0
  const freeDeliveries = active.filter((order) => order.deliveryFee === 0).length
  const freeDeliveryValue = freeDeliveries * settings.deliveryFee
  const cancellationRate = orders.length > 0 ? cancelled.length / orders.length : 0

  const whatsappOrders = orders.filter((order) => order.note?.startsWith('[WhatsApp]')).length
  const siteOrders = orders.length - whatsappOrders

  const bestSellers = new Map<string, { quantity: number; revenue: number }>()
  for (const order of active) {
    for (const item of order.items) {
      const current = bestSellers.get(item.title) ?? { quantity: 0, revenue: 0 }
      bestSellers.set(item.title, {
        quantity: current.quantity + item.quantity,
        revenue: current.revenue + item.price * item.quantity,
      })
    }
  }
  const topProducts = [...bestSellers.entries()]
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 5)

  const cities = new Map<string, number>()
  for (const order of active) {
    cities.set(order.city, (cities.get(order.city) ?? 0) + 1)
  }
  const topCities = [...cities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)

  const risks = summarizeRisks(orders)
  const openRisks = summarizeRisks(
    orders.filter((order) => order.status === 'en_attente' || order.status === 'confirmee')
  )

  // ---- Pricing view: real catalogue prices, no invented costs ----
  const priced = products.map((product) => {
    const effective = getStorePrice(product, settings)
    const listPrice =
      product.originalPrice && product.originalPrice > effective ? product.originalPrice : null
    const depth = listPrice ? (listPrice - effective) / listPrice : 0
    return { product, effective, listPrice, depth }
  })

  const depths = priced.map((entry) => entry.depth).filter((depth) => depth > 0)
  const medianDepth = median(depths)
  const categoryMedians = new Map<string, number>()
  for (const slug of new Set(priced.map((entry) => entry.product.slugCategory))) {
    categoryMedians.set(
      slug,
      median(priced.filter((entry) => entry.product.slugCategory === slug).map((entry) => entry.effective))
    )
  }
  const promoCount = priced.filter((entry) => entry.listPrice).length
  const withoutPromo = priced.filter((entry) => !entry.listPrice)
  const averageShelfPrice =
    priced.length > 0 ? Math.round(priced.reduce((sum, entry) => sum + entry.effective, 0) / priced.length) : 0
  const suggestedPrice = (price: number) =>
    Math.max(9, Math.round((Math.round(price * (1 - medianDepth)) - 9) / 10) * 10 + 9)

  const kpis = [
    { label: 'Ventes en ligne (net)', value: formatMAD(revenue), icon: Banknote },
    { label: 'Commandes', value: String(orders.length), icon: ShoppingCart },
    { label: 'Panier moyen', value: formatMAD(averageBasket), icon: BadgePercent },
    { label: 'Remises accordées', value: formatMAD(totalDiscount), icon: Banknote },
  ]

  return (
    <div className="flex flex-col gap-fib-4">
      <div>
        <p className="text-eyebrow uppercase text-text-muted">Pilotage</p>
        <h1 className="mt-fib-1 text-title text-ink">Risque, ventes & prix</h1>
        <p className="mt-fib-1 max-w-2xl text-sm leading-relaxed text-text-muted">
          Tout est calculé sur tes vraies commandes et ton vrai catalogue. Aucun prix n’est
          modifié ici : les suggestions s’appliquent depuis Paramètres ou Promotions.
        </p>
      </div>

      {/* Money */}
      <div className="grid gap-fib-3 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div
              key={kpi.label}
              className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline"
            >
              <div className="flex items-center justify-between">
                <p className="text-eyebrow uppercase text-text-muted">{kpi.label}</p>
                <Icon size={17} className="text-text-muted" />
              </div>
              <p className="mt-fib-2 text-[26px] font-semibold tabular text-ink">{kpi.value}</p>
            </div>
          )
        })}
      </div>

      <div className="grid gap-fib-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline">
          <p className="text-eyebrow uppercase text-text-muted">Commandes remisées</p>
          <p className="mt-2 text-xl font-semibold tabular text-ink">
            {discountedOrders}/{active.length}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {percent(discountRate)} du chiffre brut part en remise ({formatMAD(totalDiscount)}).
          </p>
        </div>
        <div className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline">
          <p className="text-eyebrow uppercase text-text-muted">Livraisons offertes</p>
          <p className="mt-2 text-xl font-semibold tabular text-ink">{freeDeliveries}</p>
          <p className="mt-1 text-xs text-text-muted">
            {formatMAD(freeDeliveryValue)} offerts en livraison (seuil {settings.freeDeliveryMinItems} pièces).
          </p>
        </div>
        <div className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline">
          <p className="text-eyebrow uppercase text-text-muted">Prix moyen vendu</p>
          <p className="mt-2 text-xl font-semibold tabular text-ink">
            {formatMAD(averageUnitPrice)}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {itemsSold} article{itemsSold > 1 ? 's' : ''} vendu{itemsSold > 1 ? 's' : ''} hors annulations.
          </p>
        </div>
        <div className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline">
          <p className="text-eyebrow uppercase text-text-muted">Annulations</p>
          <p className="mt-2 text-xl font-semibold tabular text-ink">{percent(cancellationRate)}</p>
          <p className="mt-1 text-xs text-text-muted">
            {cancelled.length} commande{cancelled.length > 1 ? 's' : ''} annulée
            {cancelled.length > 1 ? 's' : ''} sur {orders.length}.
          </p>
        </div>
      </div>

      {/* Risk */}
      <section className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-heading text-ink">
              <ShieldAlert size={17} /> Gestion du risque (paiement à la livraison)
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Chaque commande reçoit un score lisible : annulations passées, commandes empilées,
              montant en espèces, quantité, nouveau numéro.
            </p>
          </div>
          <Link
            href="/admin/orders"
            className="press rounded-full bg-ink px-4 py-2 text-xs font-medium text-white hover:bg-ink/90"
          >
            Traiter les commandes →
          </Link>
        </div>

        <div className="mt-fib-3 grid gap-fib-2 md:grid-cols-3">
          {(['eleve', 'moyen', 'faible'] as const).map((level) => (
            <div key={level} className="rounded-2xl bg-surface-soft p-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
                {RISK_LEVEL_LABELS[level]}
              </p>
              <p className="mt-1 text-xl font-semibold tabular text-ink">
                {openRisks.counts[level]}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">commandes en cours</p>
            </div>
          ))}
        </div>

        {openRisks.highRisk.length > 0 ? (
          <ul className="mt-fib-3 divide-y divide-hairline">
            {openRisks.highRisk.slice(0, 5).map(({ order, risk }) => (
              <li key={order.id}>
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm transition-colors hover:bg-surface-soft/60"
                >
                  <span className="min-w-0">
                    <span className="font-mono text-xs font-semibold text-ink">
                      {orderReference(order.id)}
                    </span>
                    <span className="ms-2 text-text-muted">
                      {order.customerName} · {formatMAD(order.total)}
                    </span>
                    <span className="mt-1 block text-xs text-rose-700">
                      {risk.reasons.join(' · ')}
                    </span>
                  </span>
                  <span className="text-xs font-medium text-ink">Vérifier →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-fib-3 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 size={16} /> Aucune commande en cours à risque élevé.
          </p>
        )}
      </section>

      {/* Sales detail */}
      <div className="grid gap-fib-3 lg:grid-cols-3">
        <section className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline">
          <h2 className="flex items-center gap-2 text-heading text-ink">
            <MessageCircle size={16} /> Canaux
          </h2>
          {orders.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">Aucune commande enregistrée.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              <li className="flex justify-between">
                <span className="text-text-muted">Site (checkout)</span>
                <span className="tabular font-medium text-ink">{siteOrders}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-text-muted">WhatsApp</span>
                <span className="tabular font-medium text-ink">{whatsappOrders}</span>
              </li>
            </ul>
          )}
        </section>

        <section className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline">
          <h2 className="flex items-center gap-2 text-heading text-ink">
            <Package size={16} /> Meilleures ventes
          </h2>
          {topProducts.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">
              Les meilleures ventes apparaîtront après la première commande.
            </p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {topProducts.map(([title, stats]) => (
                <li key={title} className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate text-text-muted">{title}</span>
                  <span className="shrink-0 tabular text-xs font-medium text-ink">
                    ×{stats.quantity} · {formatMAD(stats.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline">
          <h2 className="flex items-center gap-2 text-heading text-ink">
            <Truck size={16} /> Villes
          </h2>
          {topCities.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">Aucune ville à afficher.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {topCities.map(([city, count]) => (
                <li key={city} className="flex justify-between">
                  <span className="text-text-muted">{city}</span>
                  <span className="tabular font-medium text-ink">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Pricing */}
      <section className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-heading text-ink">
              <BadgePercent size={17} /> Prix & remises du catalogue
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-muted">
              {promoCount}/{priced.length} pièces ont déjà un prix barré. La remise médiane du
              catalogue est de {percent(medianDepth)} · prix affiché moyen {formatMAD(averageShelfPrice)}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/settings"
              className="press rounded-full border border-hairline px-4 py-2 text-xs font-medium text-ink hover:bg-surface-soft"
            >
              Promo boutique →
            </Link>
            <Link
              href="/admin/coupons"
              className="press rounded-full border border-hairline px-4 py-2 text-xs font-medium text-ink hover:bg-surface-soft"
            >
              Codes promo →
            </Link>
          </div>
        </div>

        {medianDepth > 0 && withoutPromo.length > 0 && (
          <p className="mt-fib-3 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            {withoutPromo.length} pièce{withoutPromo.length > 1 ? 's' : ''} sans prix barré. En
            appliquant la remise médiane ({percent(medianDepth)}), leur prix d’appel serait celui
            indiqué ci-dessous — une suggestion, rien n’est appliqué automatiquement.
          </p>
        )}

        <div className="mt-fib-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface-soft text-left text-[11px] uppercase tracking-[0.12em] text-text-muted">
              <tr>
                <th className="px-4 py-3">Pièce</th>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">Prix affiché</th>
                <th className="px-4 py-3">Prix barré</th>
                <th className="px-4 py-3">Remise</th>
                <th className="px-4 py-3">Médiane catégorie</th>
                <th className="px-4 py-3">Prix d’appel suggéré</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {priced.map(({ product, effective, listPrice, depth }) => {
                const categoryMedian = categoryMedians.get(product.slugCategory) ?? effective
                const gap = categoryMedian > 0 ? (effective - categoryMedian) / categoryMedian : 0
                return (
                  <tr key={product.id} className="hover:bg-surface-soft/60">
                    <td className="px-4 py-3 font-medium text-ink">{product.title}</td>
                    <td className="px-4 py-3 text-xs text-text-muted">{product.categoryName}</td>
                    <td className="px-4 py-3 tabular font-medium text-ink">
                      {formatMAD(effective)}
                      {gap !== 0 && (
                        <span className={`ms-1 text-[11px] ${gap > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          ({gap > 0 ? '+' : ''}
                          {Math.round(gap * 100)} % vs médiane)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular text-text-muted">
                      {listPrice ? formatMAD(listPrice) : '—'}
                    </td>
                    <td className="px-4 py-3 tabular text-text-muted">
                      {depth > 0 ? `−${percent(depth)}` : '—'}
                    </td>
                    <td className="px-4 py-3 tabular text-text-muted">{formatMAD(categoryMedian)}</td>
                    <td className="px-4 py-3 tabular text-ink">
                      {listPrice || medianDepth === 0 ? '—' : formatMAD(suggestedPrice(effective))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
