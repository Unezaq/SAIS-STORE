import type { Metadata } from 'next'
import { CheckoutForm } from '@/components/storefront/CheckoutForm'
import { getClientByAuthUserId } from '@/lib/store'
import { getCustomerById } from '@/lib/auth/customers'
import { getSettings } from '@/lib/products'
import { getAuthenticatedUser } from '@/lib/supabase/auth'
import { getCustomerFromSession } from '@/lib/auth/current-customer'
import type { CustomerRow } from '@/lib/auth/customers'

type CheckoutProfile = {
  email: string | null
  firstName: string
  lastName: string
  phone: string
  address: string
} | null

export const metadata: Metadata = {
  title: 'Finaliser ma commande',
  description: 'Finalisez votre commande SAIS avec paiement à la livraison partout au Maroc.',
  robots: { index: false, follow: false },
}

export default async function CheckoutPage() {
  const [settings, authUser, customer] = await Promise.all([
    getSettings(),
    getAuthenticatedUser(),
    getCustomerFromSession(),
  ])

  let client: CheckoutProfile = null
  if (authUser) {
    const storeClient = await getClientByAuthUserId(authUser.id)
    if (storeClient) {
      client = {
        email: storeClient.email,
        firstName: storeClient.firstName,
        lastName: storeClient.lastName,
        phone: storeClient.phone,
        address: storeClient.address ?? '',
      }
    }
  } else if (customer) {
    const customerRow = await getCustomerById(customer.id)
    if (customerRow) {
      const parts = customerRow.full_name.split(' ')
      client = {
        email: customerRow.email || null,
        firstName: parts[0] ?? '',
        lastName: parts.slice(1).join(' ') ?? '',
        phone: customerRow.phone,
        address: customerRow.address,
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-fib-3 py-fib-5 md:px-fib-4 md:py-fib-7">
      <header className="mb-6 text-center">
        <p className="text-eyebrow uppercase text-text-muted">Paiement à la livraison</p>
        <h1 className="mt-2 text-title text-ink">Finaliser ma commande</h1>
      </header>
      <CheckoutForm
        settings={settings}
        profile={client}
        isAuthenticated={Boolean(authUser || customer)}
      />
    </div>
  )
}
