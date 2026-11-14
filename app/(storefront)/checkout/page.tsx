import type { Metadata } from 'next'
import { CheckoutForm } from '@/components/storefront/CheckoutForm'
import { getClientByAuthUserId } from '@/lib/store'
import { getSettings } from '@/lib/products'
import { getAuthenticatedUser } from '@/lib/supabase/auth'

export const metadata: Metadata = {
  title: 'Finaliser ma commande',
  description: 'Finalisez votre commande SAIS avec paiement à la livraison partout au Maroc.',
  robots: { index: false, follow: false },
}

export default async function CheckoutPage() {
  const [settings, user] = await Promise.all([getSettings(), getAuthenticatedUser()])
  const client = user ? await getClientByAuthUserId(user.id) : null

  return (
    <div className="mx-auto w-full max-w-7xl px-fib-3 py-fib-5 md:px-fib-4 md:py-fib-7">
      <header className="mb-6 text-center">
        <p className="text-eyebrow uppercase text-text-muted">Paiement à la livraison</p>
        <h1 className="mt-2 text-title text-ink">Finaliser ma commande</h1>
      </header>
      <CheckoutForm settings={settings} profile={client} />
    </div>
  )
}
