import Link from 'next/link'
import { Heart, MessageCircle, Package, ShieldCheck, Truck, Clock, Mail, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { AccountProfileForm } from '@/components/storefront/AccountProfileForm'
import { getClientByAuthUserId, getOrdersByAuthUserId } from '@/lib/store'
import { getAuthenticatedUser } from '@/lib/supabase/auth'
import { getSettings } from '@/lib/products'

const reassurance = [
  {
    icon: Package,
    title: 'Colis en 24–48h',
    body: 'Expédition le jour même pour toute commande confirmée avant 15h.',
  },
  {
    icon: ShieldCheck,
    title: 'Paiement à la livraison',
    body: 'Vous réglez en espèces au livreur. Aucune carte bancaire requise.',
  },
  {
    icon: MessageCircle,
    title: 'Une conseillère dédiée',
    body: 'Un message WhatsApp suffit — nous confirmons taille et livraison.',
  },
]

export default async function AccountPage() {
  const user = await getAuthenticatedUser()
  const clientEmail = user?.email ?? null
  const { whatsappPhone } = await getSettings()

  // Si client connecté → afficher ses commandes
  if (user && clientEmail) {
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
                {new Date(client?.createdAt ?? Date.now()).toLocaleDateString('fr-MA')}
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
                    <td className="px-fib-3 py-3 font-mono text-xs text-text-muted">{o.id}</td>
                    <td className="px-fib-3 py-3 text-xs text-text-muted">
                      {new Date(o.createdAt).toLocaleDateString('fr-MA')}
                    </td>
                    <td className="px-fib-3 py-3 text-xs text-text-muted">
                      {o.items.map((i) => `${i.title} ×${i.quantity}`).join(' · ')}
                    </td>
                    <td className="px-fib-3 py-3 tabular font-medium">{o.total} MAD</td>
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
                        {o.status === 'en_attente' && <Clock className="h-3 w-3" />}
                        {o.status === 'confirmee' && <ShieldCheck className="h-3 w-3" />}
                        {o.status === 'expediee' && <Truck className="h-3 w-3" />}
                        {o.status === 'livree' && <Mail className="h-3 w-3" />}
                        {o.status === 'annulee' && <User className="h-3 w-3" />}
                        {o.status === 'en_attente' ? 'En attente'
                        : o.status === 'confirmee' ? 'Confirmée'
                        : o.status === 'expediee' ? 'Expédiée'
                        : o.status === 'livree' ? 'Livrée'
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

  // Sinon → formulaire de suivi par téléphone (invité)
  return (
    <div className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-4 md:px-fib-4 md:pt-fib-5">
      <div className="mb-fib-4 max-w-2xl md:mb-fib-5">
        <p className="text-eyebrow uppercase text-text-muted">Commandes</p>
        <h1 className="mt-fib-1 text-title text-ink">Suivre ma commande</h1>
        <p className="mt-fib-2 text-sm leading-relaxed text-text-muted md:text-[15px]">
          Chez SAIS, pas de compte obligatoire : votre commande vit sur WhatsApp. Donnez-nous votre
          numéro et une conseillère vous répond avec le statut de la livraison.
          <br />
          <span className="text-xs text-green-600">
            Vous avez un compte ?{' '}
            <Link href="/login" className="text-ink font-medium hover:underline">Connectez-vous ici</Link>
            pour suivre vos commandes automatiquement.
          </span>
        </p>
      </div>

      <ScrollReveal variant="fade-up" delay={0.05}>
        <div className="grid gap-fib-2 md:grid-cols-12 md:gap-fib-3">
          <div className="rounded-[24px] bg-surface-soft p-fib-3 md:col-span-7 md:p-fib-4">
            <h2 className="text-heading text-ink">Vérifier une livraison</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
              Votre numéro est celui utilisé lors de la commande.
            </p>

            <div className="mt-fib-3 flex flex-col gap-fib-2 sm:flex-row sm:items-end">
              <div className="relative">
                <Input
                  label="Numéro de téléphone"
                  placeholder="06 12 34 56 78"
                  inputMode="tel"
                  startIcon={<span className="text-xs font-bold text-ink">🇲🇦</span>}
                  helperText="Nous l’utilisons uniquement pour retrouver votre commande."
                />
              </div>
              <Button
                size="lg"
                leftIcon={<MessageCircle size={16} />}
                className="w-full sm:w-auto"
                onClick={() => {
                  const phoneInput = document.querySelector('input[inputmode="tel"]') as HTMLInputElement | null
                  const phone = phoneInput?.value.trim() || '(à préciser)'
                  const message = encodeURIComponent(
                    `Bonjour SAIS, je souhaite vérifier le statut de ma commande.\nMon numéro : ${phone}`
                  )
                  const url = `https://wa.me/${whatsappPhone}?text=${message}`
                  window.open(url, '_blank')
                }}
              >
                Vérifier sur WhatsApp
              </Button>
            </div>
          </div>

          <div className="rounded-[24px] bg-primary p-fib-3 text-white md:col-span-5 md:p-fib-4">
            <h2 className="text-heading text-white">Nouvelle commande</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-white/70">
              Choisissez votre pièce, puis envoyez-nous un message : nous confirmons la taille et
              l'adresse, vous payez à la réception.
            </p>
            <Link
              href="/boutique"
              className="press mt-fib-3 inline-flex items-center gap-2 rounded-full bg-white px-fib-3 py-fib-1 text-sm font-medium text-primary hover:bg-white/90"
            >
              Voir la boutique
            </Link>
          </div>
        </div>
      </ScrollReveal>

      <div className="mt-fib-2 grid gap-fib-2 md:mt-fib-3 md:grid-cols-3">
        {reassurance.map((item, index) => {
          const Icon = item.icon
          return (
            <ScrollReveal key={item.title} variant="fade-up" delay={index * 0.08}>
              <div className="flex h-full flex-col justify-between rounded-[24px] bg-surface-soft p-fib-3 md:min-h-[200px] md:p-fib-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white">
                  <Icon size={17} strokeWidth={1.8} />
                </span>
                <div className="mt-fib-4">
                  <h3 className="text-heading text-ink">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{item.body}</p>
                </div>
              </div>
            </ScrollReveal>
          )
        })}
      </div>
    </div>
  )
}
