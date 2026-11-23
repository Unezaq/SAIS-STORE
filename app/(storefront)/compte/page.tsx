import type { Metadata } from 'next'
import Link from 'next/link'
import { getAuthenticatedUser } from '@/lib/security/auth'
import { getSettings } from '@/lib/products'
import { AccountForms } from '@/components/storefront/AccountForms'
import { TrackOrderForm } from '@/components/storefront/TrackOrderForm'
import CustomerProfile from '@/components/storefront/CustomerProfile'

export const metadata: Metadata = {
  title: 'Mon compte',
  description:
    'Gérez votre profil, vos adresses et suivez vos commandes chez SAIS Store.',
  alternates: { canonical: '/compte' },
}

export const dynamic = 'force-dynamic'

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  const [{ mode }, user, settings] = await Promise.all([
    searchParams,
    getAuthenticatedUser(),
    getSettings(),
  ])
  const metadata = user?.user_metadata ?? {}
  const fullName =
    (typeof metadata.full_name === 'string' && metadata.full_name) ||
    user?.email?.split('@')[0] ||
    'Cliente'
  const initialMode = mode === 'connexion' ? 'connexion' : 'inscription'

  return (
    <div className="mx-auto w-full max-w-5xl px-fib-3 py-fib-5 md:px-fib-4 md:py-fib-6">
      <p className="text-eyebrow uppercase text-text-muted">Mon compte</p>
      <h1 className="mt-fib-1 text-title text-ink">
        {user ? `Bonjour ${fullName}.` : 'Votre compte SAIS'}
      </h1>
      <p className="mt-fib-2 max-w-xl text-sm leading-relaxed text-text-muted md:text-[15px]">
        {user
          ? 'Gérez votre profil, vos adresses de livraison et suivez vos commandes en un coup d’œil.'
          : 'Créer un compte est facultatif. Il vous donne accès à vos avantages et à l’historique de vos commandes, sans jamais vous obliger à passer par lui pour commander.'}
      </p>

      <div className="mt-fib-4">
        {user ? (
          <CustomerProfile
            initialTab={
              mode === 'adresses' ? 'adresses' : mode === 'commandes' ? 'commandes' : 'infos'
            }
          />
        ) : (
          <AccountForms initialMode={initialMode} />
        )}
      </div>

      {user && (
        <section className="mt-fib-5">
          <p className="text-eyebrow uppercase text-text-muted">Suivi rapide</p>
          <h2 className="mt-fib-1 text-heading text-ink">Suivre une commande</h2>
          <p className="mt-fib-1 max-w-xl text-sm leading-relaxed text-text-muted md:text-[15px]">
            Entrez votre téléphone et votre référence SAIS-… pour voir le statut
            immédiatement.
          </p>
          <div className="mt-fib-3">
            <TrackOrderForm whatsappPhone={settings.whatsappPhone} />
          </div>
        </section>
      )}
    </div>
  )
}
