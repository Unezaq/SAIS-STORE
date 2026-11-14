'use client'

import * as React from 'react'
import Link from 'next/link'
import { createClientOrderAction } from '@/actions/admin'
import { Button } from '@/components/ui/Button'
import { useCart } from '@/components/storefront/CartProvider'
import type { StoreClient, StoreOrder, StoreSettings } from '@/lib/types/store'
import { clientEnv } from '@/lib/env'
import { formatMAD } from '@/lib/utils'

interface Confirmation {
  orderId: string
  total: number
  items: Array<StoreOrder['items'][number] & { imageUrl: string }>
}

const fieldClassName =
  'w-full rounded-xl border border-hairline bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10'

export function CheckoutForm({
  settings,
  profile,
}: {
  settings: StoreSettings
  profile: Pick<StoreClient, 'email' | 'firstName' | 'lastName' | 'phone' | 'address'> | null
}) {
  const { items, subtotal, ready, clearCart } = useCart()
  const itemCount = items.reduce((total, item) => total + item.quantity, 0)
  const deliveryFee =
    settings.freeDeliveryMinItems > 0 && itemCount >= settings.freeDeliveryMinItems
      ? 0
      : settings.deliveryFee
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState('')
  const [confirmation, setConfirmation] = React.useState<Confirmation | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')

    const formData = new FormData(event.currentTarget)
    formData.set(
      'items',
      JSON.stringify(items.map(({ slug, color, size, quantity }) => ({
        slug,
        color,
        size,
        quantity,
      })))
    )

    try {
      const result = await createClientOrderAction(formData)
      if (!result.ok) {
        setError(result.error)
        setPending(false)
        return
      }

      setConfirmation({ orderId: result.orderId, total: result.total, items: result.items })
      clearCart()
    } catch {
      setError('Impossible d’enregistrer la commande. Réessayez ou contactez-nous sur WhatsApp.')
      setPending(false)
    }
  }

  if (!ready) {
    return <p className="py-12 text-center text-sm text-text-muted">Chargement du panier…</p>
  }

  if (confirmation) {
    const itemDetails = confirmation.items.map((item, index) => {
      const productUrl = new URL(
        `/products/${encodeURIComponent(item.slug)}`,
        clientEnv.NEXT_PUBLIC_SITE_URL
      ).toString()
      const imageUrl = new URL(item.imageUrl, clientEnv.NEXT_PUBLIC_SITE_URL).toString()
      const variants = [item.color, item.size].filter(Boolean).join(' · ')

      return [
        `${index + 1}. ${item.title}${variants ? ` (${variants})` : ''}`,
        `Quantité : ${item.quantity} · ${formatMAD(item.price * item.quantity)}`,
        `Photo : ${imageUrl}`,
        `Fiche produit : ${productUrl}`,
      ].join('\n')
    }).join('\n\n')
    const whatsappText = encodeURIComponent(
      `Bonjour SAIS 👋\nMa commande ${confirmation.orderId} est enregistrée.\n\n${itemDetails}\n\nTotal à payer à la livraison : ${formatMAD(confirmation.total)}\nMerci de confirmer la commande.`
    )
    return (
      <section className="mx-auto max-w-xl rounded-[24px] bg-white p-6 text-center shadow-sm ring-1 ring-hairline md:p-10">
        <p className="text-eyebrow uppercase text-text-muted">Commande enregistrée</p>
        <h1 className="mt-2 text-title text-ink">Merci pour votre commande.</h1>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">
          Référence <strong className="text-ink">{confirmation.orderId}</strong> · Total, livraison incluse{' '}
          <strong className="text-ink">{formatMAD(confirmation.total)}</strong>. La livraison est incluse et le paiement se fait à la réception.
        </p>
        <p className="mt-2 text-xs text-text-muted">
          Le message WhatsApp contient les détails et les liens des photos. Appuyez sur Envoyer dans WhatsApp pour le transmettre.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href={`https://wa.me/${settings.whatsappPhone}?text=${whatsappText}`}
            target="_blank"
            rel="noreferrer"
            className="press inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-white hover:bg-primary-light"
          >
            Confirmer sur WhatsApp
          </a>
          <Link
            href="/boutique"
            className="press inline-flex h-12 items-center justify-center rounded-full border border-hairline px-6 text-sm font-medium text-ink hover:bg-surface-soft"
          >
            Continuer mes achats
          </Link>
        </div>
      </section>
    )
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-xl rounded-[24px] bg-white p-6 text-center shadow-sm ring-1 ring-hairline md:p-10">
        <h1 className="text-title text-ink">Votre panier est vide</h1>
        <p className="mt-3 text-sm text-text-muted">Ajoutez une pièce avant de valider la commande.</p>
        <Link
          href="/boutique"
          className="press mt-6 inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-white hover:bg-primary-light"
        >
          Parcourir la boutique
        </Link>
      </section>
    )
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_0.8fr]">
      <form onSubmit={handleSubmit} className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-hairline md:p-7">
        <h2 className="text-heading text-ink">Informations de livraison</h2>
        <p className="mt-1 text-sm text-text-muted">
          Paiement en espèces à la réception. Aucun paiement en ligne n’est demandé.
        </p>
        {profile && (
          <p className="mt-2 text-xs text-text-muted">
            Vos coordonnées enregistrées sont préremplies. Vous pouvez les modifier pour cette commande.
          </p>
        )}

        <div className="mt-6 grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium text-ink">
            Nom complet
            <input
              name="customerName"
              autoComplete="name"
              defaultValue={profile ? `${profile.firstName} ${profile.lastName}`.trim() : ''}
              required
              maxLength={160}
              className={fieldClassName}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-ink">
            Téléphone
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              defaultValue={profile?.phone ?? ''}
              placeholder="+212 6 44 81 65 44"
              required
              maxLength={18}
              className={fieldClassName}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-ink">
            Adresse complète (ville, quartier, rue)
            <textarea
              name="address"
              autoComplete="street-address"
              defaultValue={profile?.address ?? ''}
              required
              maxLength={500}
              rows={3}
              className={fieldClassName}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-ink">
            Email <span className="font-normal text-text-muted">(facultatif)</span>
            <input
              name="clientEmail"
              type="email"
              autoComplete="email"
              defaultValue={profile?.email ?? ''}
              maxLength={254}
              className={fieldClassName}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-ink">
            Note pour la livraison <span className="font-normal text-text-muted">(facultatif)</span>
            <textarea name="note" maxLength={1000} rows={2} className={fieldClassName} />
          </label>
        </div>

        {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}

        <Button type="submit" size="lg" className="mt-6 w-full" isLoading={pending} disabled={pending}>
          {pending ? 'Enregistrement…' : 'Confirmer la commande'}
        </Button>
      </form>

      <aside className="h-fit rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-hairline md:p-7">
        <h2 className="text-heading text-ink">Votre commande</h2>
        <ul className="mt-4 divide-y divide-hairline">
          {items.map((item, index) => (
            <li key={`${item.slug}-${item.size ?? ''}-${item.color ?? ''}-${index}`} className="flex justify-between gap-4 py-3 text-sm">
              <span className="min-w-0 text-text-muted">
                <span className="block truncate font-medium text-ink">{item.title}</span>
                <span>{[item.color, item.size].filter(Boolean).join(' · ') || 'Sans variante'} · Qté {item.quantity}</span>
              </span>
              <span className="shrink-0 font-medium text-ink">{formatMAD(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-hairline pt-4 text-sm">
          <span className="text-text-muted">Sous-total</span>
          <span className="font-semibold text-ink">{formatMAD(subtotal)}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-text-muted">Livraison</span>
          <span className="font-medium text-ink">
            {deliveryFee === 0 ? 'Gratuite' : formatMAD(deliveryFee)}
          </span>
        </div>
        <div className="mt-3 flex justify-between border-t border-hairline pt-3 text-sm">
          <span className="font-semibold text-ink">Total à payer à la livraison</span>
          <span className="font-semibold text-ink">{formatMAD(subtotal + deliveryFee)}</span>
        </div>
        {deliveryFee === 0 && settings.freeDeliveryMinItems > 0 && (
          <p className="mt-2 text-xs text-primary">
            Livraison offerte dès {settings.freeDeliveryMinItems} pièces.
          </p>
        )}
        <p className="mt-2 text-xs leading-relaxed text-text-muted">
          Les prix des produits sont revérifiés côté serveur au moment de la commande.
        </p>
      </aside>
    </div>
  )
}
