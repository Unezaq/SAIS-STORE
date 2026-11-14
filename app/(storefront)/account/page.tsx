import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Heart,
  MessageCircle,
  Package,
  ShieldCheck,
  Truck,
  Clock,
  Mail,
  User,
} from 'lucide-react'
import { AccountProfileForm } from '@/components/storefront/AccountProfileForm'
import { getClientByAuthUserId, getOrdersByAuthUserId } from '@/lib/store'
import { getAuthenticatedUser } from '@/lib/supabase/auth'
import { getSettings } from '@/lib/products'

export default async function AccountPage() {
  const user = await getAuthenticatedUser()
  if (!user?.email) redirect('/login?next=%2Faccount')
  if (user.app_metadata?.role === 'admin') redirect('/admin')

  const clientEmail = user.email
  const { whatsappPhone } = await getSettings()
  const [client, orders] = await Promise.all([
    getClientByAuthUserId(user.id),
    getOrdersByAuthUserId(user.id),
  ])

  return (
    <div className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-4 md:px-fib-4 md:pt-fib-5">
      <div className="mb-fib-4 max-w-2xl md:mb-fib-5">
        <p className="text-eyebrow uppercase text-text-muted">Mon compte</p>
        <h1 className="mt-fib-1 text-title text-ink">Votre espace client</h1>
        <p className="mt-fib-2 text-sm leading-relaxed text-text-muted md:text-[15px]">
          Retrouvez vos informations et le suivi de vos commandes chez SAIS.
        </p>
      </div>

      {/* Infos client */}
      <div className="rounded-[24px] bg-white p-fib-4 shadow-sm ring-1 ring-hairline mb-fib-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-fib-3">
          <div>
            <h2 className="text-heading text-ink">
              {client?.firstName} {client?.lastName}
            </h2>
            <p className="mt-1 text-sm text-text-muted">{clientEmail}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/wishlist"
              className="press inline-flex items-center gap-2 rounded-full border border-hairline px-fib-3 py-fib-1 text-sm font-medium text-ink hover:bg-surface-soft"
            >
              <Heart size={15} />
              Mes favoris
            </Link>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white text-xs font-medium">
              {client?.orderCount} commande{client?.orderCount !== 1 ? 's' : ''}
            </span>
            <a
              href={`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(`Bonjour SAIS, c'est ${client?.firstName}. Je souhaite suivre mes commandes.`)}`}
              target="_blank"
              rel="noreferrer"
              className="press inline-flex items-center gap-2 rounded-full bg-ink px-fib-3 py-fib-1 text-sm font-medium text-white hover:bg-ink/90"
            >
              <MessageCircle size={15} />
              Contacter SAIS
            </a>
          </div>
        </div>
        <div className="mt-fib-3 grid gap-fib-2 md:grid-cols-3">
          <div className="p-3 rounded-xl bg-surface-soft text-center">
            <p className="text-xs text-text-muted uppercase">Total dépensé</p>
            <p className="text-lg font-semibold tabular text-ink">
              {client?.totalSpent?.toLocaleString('fr-MA') ?? '0'} MAD
            </p>
          </div>
          <div className="p-3 rounded-xl bg-surface-soft text-center">
            <p className="text-xs text-text-muted uppercase">Membre depuis</p>
            <p className="text-lg font-semibold tabular text-ink">
              {new Date(client?.createdAt ?? Date.now()).toLocaleDateString(
                'fr-MA'
              )}
            </p>
          </div>
        </div>
      </div>

      <AccountProfileForm
        profile={{
          firstName: client?.firstName ?? '',
          lastName: client?.lastName ?? '',
          phone: client?.phone ?? '',
          address: client?.address,
        }}
      />

      {/* Mes commandes */}
      <div className="rounded-[24px] bg-white shadow-sm ring-1 ring-hairline">
        <div className="px-fib-4 py-fib-3 border-b border-hairline">
          <h2 className="text-heading text-ink">Mes commandes</h2>
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
          <table className="w-full text-sm divide-y divide-hairline">
            <thead className="bg-surface-soft text-left text-[11px] uppercase tracking-[0.12em] text-text-muted">
              <tr>
                <th className="px-fib-3 py-3">N° commande</th>
                <th className="px-fib-3 py-3">Date</th>
                <th className="px-fib-3 py-3">Articles</th>
                <th className="px-fib-3 py-3">Total (livraison incluse)</th>
                <th className="px-fib-3 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-surface-soft/60">
                  <td className="px-fib-3 py-3 font-mono text-xs text-text-muted">
                    {o.id}
                  </td>
                  <td className="px-fib-3 py-3 text-xs text-text-muted">
                    {new Date(o.createdAt).toLocaleDateString('fr-MA')}
                  </td>
                  <td className="px-fib-3 py-3 text-xs text-text-muted">
                    {o.items
                      .map((i) => `${i.title} ×${i.quantity}`)
                      .join(' · ')}
                  </td>
                  <td className="px-fib-3 py-3 tabular font-medium">
                    {o.total} MAD
                  </td>
                  <td className="px-fib-3 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        o.status === 'livree'
                          ? 'bg-green-50 text-green-700'
                          : o.status === 'confirmee'
                            ? 'bg-blue-50 text-blue-700'
                            : o.status === 'expediee'
                              ? 'bg-amber-50 text-amber-700'
                              : o.status === 'annulee'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-surface-soft text-text-muted'
                      }`}
                    >
                      {o.status === 'en_attente' && (
                        <Clock className="h-3 w-3" />
                      )}
                      {o.status === 'confirmee' && (
                        <ShieldCheck className="h-3 w-3" />
                      )}
                      {o.status === 'expediee' && <Truck className="h-3 w-3" />}
                      {o.status === 'livree' && <Mail className="h-3 w-3" />}
                      {o.status === 'annulee' && <User className="h-3 w-3" />}
                      {o.status === 'en_attente'
                        ? 'En attente'
                        : o.status === 'confirmee'
                          ? 'Confirmée'
                          : o.status === 'expediee'
                            ? 'Expédiée'
                            : o.status === 'livree'
                              ? 'Livrée'
                              : 'Annulée'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-fib-6 p-fib-6 rounded-[24px] bg-primary text-white">
        <h2 className="text-heading text-white">Besoin d'aide ?</h2>
        <p className="mt-1 text-sm text-white/70">
          Une conseillère répond sur WhatsApp en quelques minutes.
        </p>
        <a
          href={`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(`Bonjour SAIS, c'est ${client?.firstName}. J'ai une question sur ma commande.`)}`}
          target="_blank"
          rel="noreferrer"
          className="press mt-fib-3 inline-flex items-center gap-2 rounded-full bg-white px-fib-3 py-fib-1 text-sm font-medium text-primary hover:bg-white/90"
        >
          <MessageCircle size={15} />
          Écrire sur WhatsApp
        </a>
      </div>
    </div>
  )
}
