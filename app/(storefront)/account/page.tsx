import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Heart, LogOut, MessageCircle, Package } from 'lucide-react'
import { logoutCustomerAction } from '@/actions/customer-auth'
import { AccountProfileForm } from '@/components/storefront/AccountProfileForm'
import { OrderStatusBadge } from '@/components/storefront/OrderStatusBadge'
import { getCustomerById } from '@/lib/auth/customers'
import { getOrdersByCustomerId } from '@/lib/store'
import { getCustomerFromSession } from '@/lib/auth/current-customer'
import { getSettings } from '@/lib/products'
import { orderReference } from '@/lib/orderStatus'
import { formatMoroccanPhone, whatsappNumber } from '@/lib/phone'
import { formatMAD } from '@/lib/utils'

export default async function AccountPage() {
  const customer = await getCustomerFromSession()
  if (!customer) redirect('/login?next=%2Faccount')

  const { whatsappPhone } = await getSettings()
  const [customerProfile, orders] = await Promise.all([
    getCustomerById(customer.id),
    getOrdersByCustomerId(customer.id),
  ])

  const profile = customerProfile ?? customer
  const displayName = profile.full_name || 'Ma cliente'
  const contact = profile.phone || profile.email || ''
  const orderCount = orders.length
  const totalSpent = orders.reduce((sum, order) => sum + order.total, 0)

  return (
    <div className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-4 md:px-fib-4 md:pt-fib-5">
      <div className="mb-fib-4 flex flex-col gap-fib-3 md:mb-fib-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-eyebrow uppercase text-text-muted">Mon compte</p>
          <h1 className="mt-fib-1 text-title text-ink">Bonjour {displayName}.</h1>
          <p className="mt-fib-2 text-sm leading-relaxed text-text-muted md:text-[15px]">
            Vos informations, vos commandes et leur statut — tout au même endroit.
            {contact && <span className="mt-1 block text-xs">Compte : {contact}</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary ring-1 ring-primary/15">
            Compte client
          </span>
          <Link
            href="/wishlist"
            className="press inline-flex items-center gap-2 rounded-full border border-hairline px-fib-3 py-fib-1 text-sm font-medium text-ink hover:bg-surface-soft"
          >
            <Heart size={15} />
            Mes favoris
          </Link>
          <form
            action={async (_formData: FormData) => {
              await logoutCustomerAction()
            }}
          >
            <button
              type="submit"
              className="press inline-flex items-center gap-2 rounded-full border border-hairline px-fib-3 py-fib-1 text-sm font-medium text-text-muted hover:bg-surface-soft hover:text-ink"
            >
              <LogOut size={15} />
              Se déconnecter
            </button>
          </form>
        </div>
      </div>

      <div className="mb-fib-4 grid gap-fib-2 sm:grid-cols-3">
        <div className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline">
          <p className="text-eyebrow uppercase text-text-muted">Commandes</p>
          <p className="mt-fib-1 text-2xl font-semibold tabular text-ink">{orderCount}</p>
        </div>
        <div className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline">
          <p className="text-eyebrow uppercase text-text-muted">Total dépensé</p>
          <p className="mt-fib-1 text-2xl font-semibold tabular text-ink">
            {formatMAD(totalSpent)}
          </p>
        </div>
        <div className="rounded-[20px] bg-white p-fib-3 shadow-sm ring-1 ring-hairline">
          <p className="text-eyebrow uppercase text-text-muted">Membre depuis</p>
          <p className="mt-fib-1 text-2xl font-semibold tabular text-ink">
            {new Date(profile.created_at).toLocaleDateString('fr-MA')}
          </p>
        </div>
      </div>

      <AccountProfileForm
        profile={{
          firstName: profile.full_name?.split(' ')[0] ?? '',
          lastName: profile.full_name?.split(' ').slice(1).join(' ') ?? '',
          phone: profile.phone,
          address: profile.address ?? '',
        }}
      />

      {/* Mes commandes */}
      <section className="overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-hairline">
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-fib-4 py-fib-3">
          <h2 className="text-heading text-ink">Mes commandes</h2>
          <Link href="/suivre" className="text-xs font-medium text-text-muted hover:text-ink">
            Suivre une commande →
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="p-fib-6 text-center text-text-muted">
            <Package className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p>Aucune commande pour le moment.</p>
            <Link
              href="/boutique"
              className="press mt-3 inline-flex items-center gap-2 rounded-full bg-ink px-fib-3 py-fib-1 text-sm font-medium text-white hover:bg-ink/90"
            >
              Voir la boutique →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-hairline">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/account/orders/${order.id}`}
                  className="flex flex-col gap-2 px-fib-4 py-fib-3 transition-colors hover:bg-surface-soft/60 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[13px] font-semibold text-ink">
                        {orderReference(order.id)}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="mt-1 text-xs text-text-muted">
                      {new Date(order.createdAt).toLocaleDateString('fr-MA')} ·{' '}
                      {order.items.reduce((sum, item) => sum + item.quantity, 0)} article
                      {order.items.reduce((sum, item) => sum + item.quantity, 0) > 1 ? 's' : ''} ·{' '}
                      {order.items.map((item) => item.title).join(' · ')}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="font-semibold tabular text-ink">{formatMAD(order.total)}</span>
                    <span aria-hidden className="text-text-muted">
                      →
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-fib-4 rounded-[24px] bg-primary p-fib-4 text-white">
        <h2 className="text-heading text-white">Besoin d'aide ?</h2>
        <p className="mt-1 text-sm text-white/70">
          Une conseillère répond sur WhatsApp en quelques minutes, téléphone en main.
        </p>
        <div className="mt-fib-3 flex flex-wrap gap-2">
          <a
            href={`https://wa.me/${whatsappNumber(whatsappPhone)}?text=${encodeURIComponent(
              `Bonjour SAIS, c'est ${displayName}. J'ai une question sur ma commande.`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="press inline-flex items-center gap-2 rounded-full bg-white px-fib-3 py-fib-1 text-sm font-medium text-primary hover:bg-white/90"
          >
            <MessageCircle size={15} />
            Écrire sur WhatsApp
          </a>
          {profile.phone && (
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs text-white/70">
              Nous vous appelons au {formatMoroccanPhone(profile.phone)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
