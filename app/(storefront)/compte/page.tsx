import type { Metadata } from 'next'
import Link from 'next/link'
import { Gift, LogOut, Sparkles, Truck, UserRound } from 'lucide-react'
import { getAuthenticatedUser } from '@/lib/security/auth'
import { AccountForms } from '@/components/storefront/AccountForms'
import { logoutAccountAction } from '@/actions/customer-account'
import { formatMoroccanPhone } from '@/lib/phone'

export const metadata: Metadata = {
  title: 'Mon compte',
  description:
    'Créez votre compte SAIS Store, facultatif, et profitez des offres réservées à nos clientes fidèles. La commande sans compte reste toujours possible.',
  alternates: { canonical: '/compte' },
}

export const dynamic = 'force-dynamic'

const perks = [
  {
    icon: Gift,
    title: 'Offres clientes fidèles',
    body: 'Promotions privées et avantages réservés aux membres.',
  },
  {
    icon: Sparkles,
    title: 'Nouveautés en avant-première',
    body: 'Découvrez les nouvelles pièces avant tout le monde.',
  },
  {
    icon: Truck,
    title: 'Commande toujours sans compte',
    body: 'Le compte reste optionnel : commandez comme avant, en 2 minutes.',
  },
]

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  const [{ mode }, user] = await Promise.all([searchParams, getAuthenticatedUser()])
  const metadata = user?.user_metadata ?? {}
  const fullName =
    (typeof metadata.full_name === 'string' && metadata.full_name) ||
    user?.email?.split('@')[0] ||
    'Cliente'
  const metadataPhone = typeof metadata.phone === 'string' ? metadata.phone : null
  const initialMode = mode === 'connexion' ? 'connexion' : 'inscription'

  return (
    <div className="mx-auto w-full max-w-5xl px-fib-3 py-fib-5 md:px-fib-4 md:py-fib-6">
      <p className="text-eyebrow uppercase text-text-muted">Mon compte</p>
      <h1 className="mt-fib-1 text-title text-ink">
        {user ? `Bienvenue ${fullName}.` : 'Votre compte SAIS, si vous le souhaitez.'}
      </h1>
      <p className="mt-fib-2 max-w-xl text-sm leading-relaxed text-text-muted md:text-[15px]">
        {user
          ? 'Votre espace est prêt : retrouvez vos avantages et vos informations en un coup d’œil.'
          : 'Créer un compte est facultatif. Il vous donne accès aux offres réservées à nos clientes fidèles, sans jamais vous obliger à passer par lui pour commander.'}
      </p>

      <div className="mt-fib-4 grid gap-fib-3 md:grid-cols-[1.05fr_0.95fr] md:items-start">
        {user ? (
          <section className="rounded-[24px] bg-white p-6 shadow-sm ring-1 ring-hairline md:p-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserRound size={20} />
            </span>
            <h2 className="mt-fib-2 text-heading text-ink">Mes informations</h2>
            <dl className="mt-fib-2 divide-y divide-hairline text-sm">
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-text-muted">Nom</dt>
                <dd className="text-end font-medium text-ink">{fullName}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-text-muted">Email</dt>
                <dd className="text-end font-medium text-ink">{user.email}</dd>
              </div>
              {metadataPhone && (
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-text-muted">Téléphone</dt>
                  <dd className="text-end font-medium text-ink" dir="ltr">
                    {formatMoroccanPhone(metadataPhone)}
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-fib-3 flex flex-col gap-2 sm:flex-row">
              <Link
                href="/boutique"
                className="press inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-white hover:bg-primary-light"
              >
                Continuer mes achats
              </Link>
              <form action={logoutAccountAction}>
                <button
                  type="submit"
                  className="press inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-hairline px-6 text-sm font-medium text-text-muted hover:bg-surface-soft hover:text-ink sm:w-auto"
                >
                  <LogOut size={15} /> Se déconnecter
                </button>
              </form>
            </div>
          </section>
        ) : (
          <AccountForms initialMode={initialMode} />
        )}

        <aside className="flex flex-col gap-fib-2">
          {perks.map((perk) => {
            const Icon = perk.icon
            return (
              <div
                key={perk.title}
                className="flex items-start gap-fib-2 rounded-[20px] bg-surface-soft p-fib-3"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink">
                  <Icon size={17} strokeWidth={1.8} />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-ink">{perk.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-text-muted">{perk.body}</p>
                </div>
              </div>
            )
          })}
        </aside>
      </div>
    </div>
  )
}
