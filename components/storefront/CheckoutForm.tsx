'use client'

import * as React from 'react'
import Link from 'next/link'
import { CheckCircle, MessageCircle, ShieldCheck, Truck } from 'lucide-react'
import { placeOrderAction, type PlacedOrderItem } from '@/actions/checkout'
import { useCart } from '@/components/storefront/CartProvider'
import { OrderTimeline } from '@/components/storefront/OrderTimeline'
import { Button } from '@/components/ui/Button'
import { clientEnv } from '@/lib/env'
import { formatMoroccanPhone, normalizeMoroccanPhone, whatsappNumber } from '@/lib/phone'
import type { StoreClient, StoreSettings } from '@/lib/types/store'
import { cn, formatMAD } from '@/lib/utils'

interface DeliveryDetails {
  customerName: string
  phone: string
  address: string
  clientEmail: string
  couponCode: string
  note: string
}

interface Confirmation {
  reference: string
  phone: string
  total: number
  items: PlacedOrderItem[]
}

const fieldClassName =
  'w-full rounded-xl border border-hairline bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10'
const labelClassName = 'grid gap-1.5 text-sm font-medium text-ink'

export function CheckoutForm({
  settings,
  profile,
  isAuthenticated,
}: {
  settings: StoreSettings
  profile: Pick<StoreClient, 'email' | 'firstName' | 'lastName' | 'phone' | 'address'> | null
  isAuthenticated: boolean
}) {
  const { items, subtotal, ready, clearCart } = useCart()
  const itemCount = items.reduce((total, item) => total + item.quantity, 0)
  const deliveryFee =
    settings.freeDeliveryMinItems > 0 && itemCount >= settings.freeDeliveryMinItems
      ? 0
      : settings.deliveryFee
  const total = subtotal + deliveryFee

  const [step, setStep] = React.useState<'delivery' | 'review'>('delivery')
  const [details, setDetails] = React.useState<DeliveryDetails | null>(null)
  const [confirmed, setConfirmed] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState('')
  const [confirmation, setConfirmation] = React.useState<Confirmation | null>(null)

  function handleDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const phone = normalizeMoroccanPhone(String(formData.get('phone') ?? ''))
    const address = String(formData.get('address') ?? '').trim()

    if (!phone) {
      setError('Saisissez un numéro marocain valide, par exemple 06 12 34 56 78.')
      return
    }
    if (address.length < 10) {
      setError('Précisez votre adresse : ville, quartier et rue.')
      return
    }

    setError('')
    setDetails({
      customerName: String(formData.get('customerName') ?? '').trim(),
      phone,
      address,
      clientEmail: String(formData.get('clientEmail') ?? '').trim(),
      couponCode: String(formData.get('couponCode') ?? '').trim(),
      note: String(formData.get('note') ?? '').trim(),
    })
    setConfirmed(false)
    setStep('review')
    window.scrollTo({ top: 0 })
  }

  async function handleConfirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!details) return
    if (!confirmed) {
      setError('Merci de cocher la case pour confirmer vos informations.')
      return
    }

    setPending(true)
    setError('')

    const formData = new FormData()
    formData.set('customerName', details.customerName)
    formData.set('phone', details.phone)
    formData.set('address', details.address)
    formData.set('clientEmail', details.clientEmail)
    formData.set('couponCode', details.couponCode)
    formData.set('note', details.note)
    formData.set('confirmInfo', 'on')
    formData.set(
      'items',
      JSON.stringify(
        items.map(({ slug, color, size, quantity }) => ({ slug, color, size, quantity }))
      )
    )

    try {
      const result = await placeOrderAction(formData)
      if (!result.ok) {
        setError(result.error)
        setPending(false)
        return
      }

      setConfirmation({
        reference: result.orderNumber,
        phone: result.phone,
        total: result.total,
        items: result.items,
      })
      clearCart()
    } catch {
      setError('Impossible d’enregistrer la commande. Réessayez ou écrivez-nous sur WhatsApp.')
      setPending(false)
    }
  }

  if (!ready) {
    return <p className="py-12 text-center text-sm text-text-muted">Chargement du panier…</p>
  }

  if (confirmation) {
    const firstName = details?.customerName.split(' ')[0] ?? ''
    const itemDetails = confirmation.items
      .map((item, index) => {
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
      })
      .join('\n\n')
    const whatsappText = encodeURIComponent(
      `Bonjour SAIS 👋\nJe viens de passer la commande ${confirmation.reference}.\n\n${itemDetails}\n\nTotal à payer à la livraison : ${formatMAD(confirmation.total)}\nMerci de me confirmer la livraison.`
    )

    return (
      <section className="mx-auto max-w-2xl rounded-[24px] bg-white p-6 shadow-sm ring-1 ring-hairline md:p-8">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle size={22} />
          </span>
          <div>
            <p className="text-eyebrow uppercase text-text-muted">Commande enregistrée</p>
            <h1 className="mt-1 text-title text-ink">Merci {firstName}.</h1>
          </div>
        </div>

        <div className="mt-fib-3 rounded-2xl bg-surface-soft p-fib-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-eyebrow uppercase text-text-muted">Votre référence</p>
              <p className="mt-0.5 font-mono text-lg font-semibold tracking-wide text-ink">
                {confirmation.reference}
              </p>
            </div>
            <div className="text-end">
              <p className="text-eyebrow uppercase text-text-muted">Total à payer</p>
              <p className="mt-0.5 text-lg font-semibold text-ink">
                {formatMAD(confirmation.total)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-text-muted">
            Gardez cette référence : elle suffit, avec votre téléphone, pour suivre la commande.
            Paiement en espèces à la réception.
          </p>
        </div>

        <div className="mt-fib-3">
          <OrderTimeline status="en_attente" />
        </div>

        <p className="mt-fib-3 text-sm leading-relaxed text-text-muted">
          Nous vous appelons au{' '}
          <strong className="text-ink">{formatMoroccanPhone(confirmation.phone)}</strong> pour
          confirmer l’adresse. Vous pouvez aussi nous envoyer le récapitulatif sur WhatsApp.
        </p>

        <div className="mt-fib-3 flex flex-col gap-2 sm:flex-row">
          <a
            href={`https://wa.me/${whatsappNumber(settings.whatsappPhone)}?text=${whatsappText}`}
            target="_blank"
            rel="noreferrer"
            className="press inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-white hover:bg-primary-light"
          >
            <MessageCircle size={16} />
            Envoyer sur WhatsApp
          </a>
          <Link
            href="/suivre"
            className="press inline-flex h-12 items-center justify-center rounded-full border border-hairline px-6 text-sm font-medium text-ink hover:bg-surface-soft"
          >
            Suivre ma commande
          </Link>
          <Link
            href="/boutique"
            className="press inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-medium text-text-muted hover:text-ink"
          >
            Continuer mes achats
          </Link>
        </div>

        {!isAuthenticated && (
          <div className="mt-fib-3 rounded-2xl bg-primary/5 p-4 ring-1 ring-primary/15">
            <p className="text-sm font-medium text-ink">Gardez vos commandes au même endroit</p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              Créez votre compte avec ce numéro de téléphone : vos commandes passées seront
              rattachées automatiquement à votre espace client.
            </p>
            <Link
              href="/register"
              className="press mt-2 inline-flex h-10 items-center justify-center rounded-full bg-ink px-4 text-[13px] font-medium text-white hover:bg-ink/90"
            >
              Créer mon compte
            </Link>
          </div>
        )}
      </section>
    )
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-xl rounded-[24px] bg-white p-6 text-center shadow-sm ring-1 ring-hairline md:p-10">
        <h1 className="text-title text-ink">Votre panier est vide</h1>
        <p className="mt-3 text-sm text-text-muted">
          Ajoutez une pièce avant de valider la commande.
        </p>
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
    <div className="mx-auto w-full max-w-5xl">
      {/* Step indicator — the customer always knows where they are */}
      <ol className="mb-fib-3 flex items-center justify-center gap-2 text-xs">
        {[
          { id: 'delivery' as const, label: '1 · Livraison' },
          { id: 'review' as const, label: '2 · Confirmation' },
        ].map((item) => {
          const active = step === item.id
          const done = item.id === 'delivery' && step === 'review'

          return (
            <li
              key={item.id}
              className={cn(
                'rounded-full px-3 py-1.5 font-medium ring-1',
                active
                  ? 'bg-ink text-white ring-ink'
                  : done
                    ? 'bg-primary/10 text-primary ring-primary/20'
                    : 'bg-white text-text-muted ring-hairline'
              )}
            >
              {done ? '✓ Livraison' : item.label}
            </li>
          )
        })}
      </ol>

      {step === 'delivery' ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <form
            onSubmit={handleDetails}
            className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-hairline md:p-7"
          >
            <h2 className="text-heading text-ink">Informations de livraison</h2>
            <p className="mt-1 text-sm text-text-muted">
              Paiement en espèces à la réception. Aucun paiement en ligne n’est demandé.
            </p>
            {profile && (
              <p className="mt-2 text-xs text-text-muted">
                Vos coordonnées enregistrées sont préremplies. Vous pouvez les modifier pour
                cette commande.
              </p>
            )}

            <div className="mt-6 grid gap-4">
              <label className={labelClassName}>
                Nom complet
                <input
                  name="customerName"
                  autoComplete="name"
                  defaultValue={profile ? `${profile.firstName} ${profile.lastName}`.trim() : ''}
                  required
                  minLength={3}
                  maxLength={160}
                  className={fieldClassName}
                />
              </label>
              <label className={labelClassName}>
                Téléphone
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  defaultValue={profile?.phone ?? ''}
                  placeholder="06 12 34 56 78"
                  required
                  maxLength={18}
                  className={fieldClassName}
                />
                <span className="text-xs font-normal text-text-muted">
                  C’est le numéro que nous appellerons pour confirmer la commande.
                </span>
              </label>
              <label className={labelClassName}>
                Adresse complète (ville, quartier, rue)
                <textarea
                  name="address"
                  autoComplete="street-address"
                  defaultValue={profile?.address ?? ''}
                  required
                  minLength={10}
                  maxLength={500}
                  rows={3}
                  className={fieldClassName}
                />
              </label>
              <label className={labelClassName}>
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
              <label className={labelClassName}>
                Code de réduction
                <input
                  name="couponCode"
                  placeholder="BIENVENUE10"
                  maxLength={32}
                  className={fieldClassName}
                />
                <span className="text-xs font-normal text-text-muted">
                  Saisissez un code promo pour réduire le total.
                </span>
              </label>
              <label className={labelClassName}>
                Note pour la livraison{' '}
                <span className="font-normal text-text-muted">(facultatif)</span>
                <textarea
                  name="note"
                  maxLength={1000}
                  rows={2}
                  placeholder="Ex. appeler avant, immeuble au fond de la rue…"
                  className={fieldClassName}
                />
              </label>
            </div>

            {error && (
              <p role="alert" className="mt-4 text-sm text-rose-700">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" className="mt-6 w-full">
              Vérifier ma commande
            </Button>
          </form>

          <OrderSummary
            items={items}
            subtotal={subtotal}
            deliveryFee={deliveryFee}
            total={total}
            discountTotal={0}
            freeDeliveryMinItems={settings.freeDeliveryMinItems}
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <section className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-hairline md:p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-eyebrow uppercase text-text-muted">Étape 2</p>
                <h2 className="mt-1 text-heading text-ink">Vérifiez vos informations</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep('delivery')
                  setError('')
                }}
                className="press rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-soft"
              >
                Modifier
              </button>
            </div>

            {details && (
              <dl className="mt-4 divide-y divide-hairline rounded-2xl bg-surface-soft px-4">
                {[
                  { label: 'Nom', value: details.customerName },
                  { label: 'Téléphone', value: formatMoroccanPhone(details.phone) },
                  { label: 'Adresse', value: details.address },
                  ...(details.clientEmail
                    ? [{ label: 'Email', value: details.clientEmail }]
                    : []),
                  ...(details.note ? [{ label: 'Note', value: details.note }] : []),
                ].map((row) => (
                  <div key={row.label} className="flex flex-col gap-0.5 py-3">
                    <dt className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
                      {row.label}
                    </dt>
                    <dd className="text-sm text-ink">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            <form onSubmit={handleConfirm} className="mt-5">
              <label className="flex items-start gap-3 rounded-2xl border border-hairline p-3 text-sm leading-relaxed text-text-muted">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => {
                    setConfirmed(event.currentTarget.checked)
                    setError('')
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-primary)]"
                />
                <span>
                  Je confirme que mon nom, mon numéro de téléphone et mon adresse sont exacts.
                  La commande sera préparée avec ces informations.
                </span>
              </label>

              {error && (
                <p role="alert" className="mt-3 text-sm text-rose-700">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="mt-4 w-full"
                isLoading={pending}
                disabled={pending || !confirmed}
              >
                {pending ? 'Enregistrement…' : `Confirmer ma commande · ${formatMAD(total)}`}
              </Button>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-text-muted">
                <ShieldCheck size={13} /> Prix et frais de livraison revérifiés côté serveur.
              </p>
            </form>
          </section>

          <OrderSummary
            items={items}
            subtotal={subtotal}
            deliveryFee={deliveryFee}
            total={total}
            discountTotal={0}
            freeDeliveryMinItems={settings.freeDeliveryMinItems}
          />
        </div>
      )}
    </div>
  )
}

function OrderSummary({
  items,
  subtotal,
  deliveryFee,
  total,
  discountTotal = 0,
  freeDeliveryMinItems,
}: {
  items: ReturnType<typeof useCart>['items']
  subtotal: number
  deliveryFee: number
  total: number
  discountTotal?: number
  freeDeliveryMinItems: number
}) {
  return (
    <aside className="h-fit rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-hairline md:p-7">
      <h2 className="text-heading text-ink">Votre commande</h2>
      <ul className="mt-4 divide-y divide-hairline">
        {items.map((item, index) => (
          <li
            key={`${item.slug}-${item.size ?? ''}-${item.color ?? ''}-${index}`}
            className="flex justify-between gap-4 py-3 text-sm"
          >
            <span className="min-w-0 text-text-muted">
              <span className="block truncate font-medium text-ink">{item.title}</span>
              <span>
                {[item.color, item.size].filter(Boolean).join(' · ') || 'Sans variante'} · Qté{' '}
                {item.quantity}
              </span>
            </span>
            <span className="shrink-0 font-medium text-ink">
              {formatMAD(item.price * item.quantity)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-between border-t border-hairline pt-4 text-sm">
        <span className="text-text-muted">Sous-total</span>
        <span className="font-semibold text-ink">{formatMAD(subtotal)}</span>
      </div>
      {discountTotal && discountTotal > 0 && (
        <div className="mt-1 flex justify-between text-sm text-rose-600">
          <span>Réduction</span>
          <span className="tabular font-medium">- {formatMAD(discountTotal)}</span>
        </div>
      )}
      <div className="mt-2 flex justify-between text-sm">
        <span className="text-text-muted">Livraison</span>
        <span className="font-medium text-ink">
          {deliveryFee === 0 ? 'Gratuite' : formatMAD(deliveryFee)}
        </span>
      </div>
      <div className="mt-3 flex justify-between border-t border-hairline pt-3 text-sm">
        <span className="font-semibold text-ink">Total à payer à la livraison</span>
        <span className="font-semibold text-ink">{formatMAD(total)}</span>
      </div>
      {deliveryFee === 0 && freeDeliveryMinItems > 0 && (
        <p className="mt-2 text-xs text-primary">
          Livraison offerte dès {freeDeliveryMinItems} pièces.
        </p>
      )}
      <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
        <Truck size={13} /> Livraison 24–48h partout au Maroc
      </p>
    </aside>
  )
}
