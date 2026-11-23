import type { Metadata } from 'next'
import { CheckoutForm } from '@/components/storefront/CheckoutForm'
import { getSettings } from '@/lib/products'
import {
  getCustomerAddresses,
  getCustomerProfile,
} from '@/actions/customer-account'

export const metadata: Metadata = {
  title: 'Finaliser ma commande',
  description: 'Finalisez votre commande SAIS avec paiement à la livraison partout au Maroc.',
  robots: { index: false, follow: false },
}

export default async function CheckoutPage() {
  const [settings, profile, addresses] = await Promise.all([
    getSettings(),
    getCustomerProfile(),
    getCustomerAddresses(),
  ])

  // Un compte client doit être complet (nom et téléphone) avant de pouvoir
  // commander : on évite ainsi de ressaisir ses informations à chaque commande.
  if (profile && (!profile.fullName || !profile.phone)) {
    return (
      <div className="mx-auto w-full max-w-3xl px-fib-3 py-fib-6 md:px-fib-4 md:py-fib-8">
        <header className="mb-6 text-center">
          <p className="text-eyebrow uppercase text-text-muted">Compte incomplet</p>
          <h1 className="mt-2 text-title text-ink">Complétez votre profil avant de commander</h1>
        </header>
        <section className="rounded-[24px] bg-white p-6 shadow-sm ring-1 ring-hairline md:p-10 text-center">
          <p className="text-sm leading-relaxed text-text-muted max-w-md mx-auto mb-6">
            Votre nom, votre prénom et votre numéro de téléphone sont
            nécessaires pour enregistrer votre commande. Complétez-les dans
            votre compte, puis revenez ici pour finaliser.
          </p>
          <a
            href="/compte?mode=infos"
            className="press inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-white hover:bg-primary-light"
          >
            Aller à mon compte
          </a>
        </section>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-fib-3 py-fib-5 md:px-fib-4 md:py-fib-7">
      <header className="mb-6 text-center">
        <p className="text-eyebrow uppercase text-text-muted">Paiement à la livraison</p>
        <h1 className="mt-2 text-title text-ink">Finaliser ma commande</h1>
      </header>
      <CheckoutForm
        settings={settings}
        prefillName={profile?.fullName ?? undefined}
        prefillPhone={profile?.phone ?? undefined}
        prefillEmail={profile?.email ?? undefined}
        addresses={addresses}
        signedIn={Boolean(profile)}
      />
    </div>
  )
}
