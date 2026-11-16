import Link from 'next/link'
import { redirect } from 'next/navigation'
import { logoutCustomerAction } from '@/actions/customer-auth'
import { getCustomerFromSession } from '@/lib/auth/current-customer'
import { getOrdersByCustomerId } from '@/lib/store'
import { formatMAD } from '@/lib/utils'
import { orderReference } from '@/lib/orderStatus'
import { OrderStatusBadge } from '@/components/storefront/OrderStatusBadge'
import { ProfileForm } from './ProfileForm'

export default async function ProfilePage() {
  const customer = await getCustomerFromSession()
  if (!customer) redirect('/login?next=%2Faccount/profile')

  const orders = await getOrdersByCustomerId(customer.id)
  const totalSpent = orders.reduce((sum, order) => sum + order.total, 0)

  return (
    <div className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-4 md:px-fib-4 md:pt-fib-5">
      <Link
        href="/account"
        className="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-ink mb-fib-4"
      >
        ← Retour à mon compte
      </Link>

      <div className="grid gap-fib-4 lg:grid-cols-[1fr_2fr]">
        {/* Profile card */}
        <section className="rounded-[24px] bg-white p-fib-4 shadow-sm ring-1 ring-hairline">
          <h2 className="text-heading text-ink mb-fib-3">Mes informations</h2>
          <dl className="divide-y divide-hairline">
            <div className="flex justify-between py-fib-2">
              <dt className="text-text-muted">Nom complet</dt>
              <dd className="text-ink font-medium">{customer.full_name}</dd>
            </div>
            <div className="flex justify-between py-fib-2">
              <dt className="text-text-muted">Email</dt>
              <dd className="text-ink font-medium">{customer.email || '—'}</dd>
            </div>
            <div className="flex justify-between py-fib-2">
              <dt className="text-text-muted">Téléphone</dt>
              <dd className="text-ink font-medium">{customer.phone}</dd>
            </div>
            <div className="flex justify-between py-fib-2">
              <dt className="text-text-muted">Ville</dt>
              <dd className="text-ink font-medium">{customer.city}</dd>
            </div>
            <div className="flex justify-between py-fib-2">
              <dt className="text-text-muted">Adresse de livraison</dt>
              <dd className="text-ink font-medium">{customer.address}</dd>
            </div>
            <div className="flex justify-between py-fib-2">
              <dt className="text-text-muted">Membre depuis</dt>
              <dd className="text-ink font-medium">
                {new Date(customer.created_at).toLocaleDateString('fr-MA')}
              </dd>
            </div>
          </dl>
        </section>

        {/* Update form (Client Component) */}
        <ProfileForm customer={customer} />
      </div>

      <div className="mt-fib-4 rounded-[24px] bg-white p-fib-4 shadow-sm ring-1 ring-hairline">
        <h2 className="text-heading text-ink mb-fib-3">Mes commandes récentes</h2>
        {orders.length === 0 ? (
          <p className="text-text-muted">Aucune commande pour le moment.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {orders.slice(0, 5).map((order) => (
              <li key={order.id} className="flex flex-col gap-2 px-0 py-fib-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <span className="font-mono text-[13px] font-semibold text-ink">
                    {orderReference(order.id)}
                  </span>
                  <p className="mt-1 text-xs text-text-muted">
                    {new Date(order.createdAt).toLocaleDateString('fr-MA')}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <div>
                    <OrderStatusBadge status={order.status} />
                    <span className="mt-0.5 block text-xs text-text-muted">
                      {formatMAD(order.total)}
                    </span>
                  </div>
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Voir →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-fib-6 flex items-center gap-3">
        <form action={async (_formData: FormData) => {
          await logoutCustomerAction()
        }}>
          <button
            type="submit"
            className="press inline-flex items-center gap-2 rounded-full border border-hairline px-fib-3 py-fib-1 text-sm font-medium text-text-muted hover:bg-surface-soft hover:text-ink"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  )
}
