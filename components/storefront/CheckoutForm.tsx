'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MessageCircle, ShieldCheck, Truck } from 'lucide-react'
import { placeOrderAction, validateCouponAction } from '@/actions/checkout'
import type { CustomerAddress } from '@/actions/customer-account'
import { useCart, type CartItem } from '@/components/storefront/CartProvider'
import { Button } from '@/components/ui/Button'
import { formatMoroccanPhone, normalizeMoroccanPhone, whatsappNumber } from '@/lib/phone'
import type { StoreSettings } from '@/lib/types/store'
import { cn, formatMAD } from '@/lib/utils'

interface DeliveryDetails {
  customerName: string
  phone: string
  city: string
  address: string
  clientEmail: string
  couponCode: string
  note: string
}

type Channel = 'site' | 'whatsapp'

const fieldClassName =
  'w-full rounded-xl border border-hairline bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10'
const labelClassName = 'grid gap-1.5 text-sm font-medium text-ink'

/**
 * One key per review session: a retry after a network timeout reuses it, so
 * place_order_rpc returns the order it already created instead of duplicating.
 */
function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function addressFullName(address: CustomerAddress): string {
  return `${address.firstName} ${address.lastName}`.trim()
}

/**
 * WhatsApp recap sent to the store number: the whole order, so the team can
 * answer even if the database write failed.
 */
function buildWhatsAppUrl({
  settings,
  details,
  items,
  subtotal,
  deliveryFee,
  total,
  reference,
  failed,
}: {
  settings: StoreSettings
  details: DeliveryDetails
  items: CartItem[]
  subtotal: number
  deliveryFee: number
  total: number
  reference: string | null
  failed: boolean
}): string {
  const lines = [
    failed ? 'Commande SAIS — envoi manuel ⚠️' : 'Nouvelle commande SAIS 🛍️',
    reference ? `Référence : ${reference}` : 'Référence : à confirmer',
    '',
    `Nom : ${details.customerName}`,
    `Téléphone : ${formatMoroccanPhone(details.phone)}`,
    `Ville : ${details.city}`,
    `Adresse : ${details.address}`,
    details.clientEmail ? `Email : ${details.clientEmail}` : '',
    details.couponCode ? `Code promo : ${details.couponCode.toUpperCase()}` : '',
    details.note ? `Note : ${details.note}` : '',
    '',
    'Articles :',
    ...items.map(
      (item) =>
        `• ${item.quantity} × ${item.title} (${[item.color, item.size].filter(Boolean).join(' · ') || 'sans variante'}) — ${formatMAD(item.price * item.quantity)}`
    ),
    '',
    `Sous-total : ${formatMAD(subtotal)}`,
    `Livraison : ${deliveryFee === 0 ? 'offerte' : formatMAD(deliveryFee)}`,
    `Total à payer à la livraison : ${formatMAD(total)}`,
    failed ? '\n⚠️ Le site n’a pas pu enregistrer la commande automatiquement : merci de la saisir dans le back-office.' : '',
  ].filter((line) => line !== '')

  return `https://wa.me/${whatsappNumber(settings.whatsappPhone)}?text=${encodeURIComponent(lines.join('\n'))}`
}

export function CheckoutForm({
  settings,
  prefillName,
  prefillPhone,
  prefillEmail,
  addresses = [],
  signedIn = false,
}: {
  settings: StoreSettings
  prefillName?: string
  prefillPhone?: string
  prefillEmail?: string
  addresses?: CustomerAddress[]
  signedIn?: boolean
}) {
  const { items, subtotal, ready, clearCart } = useCart()
  const router = useRouter()
  const itemCount = items.reduce((total, item) => total + item.quantity, 0)
  const deliveryFee =
    settings.freeDeliveryMinItems > 0 && itemCount >= settings.freeDeliveryMinItems
      ? 0
      : settings.deliveryFee

  // The default saved address (or the most recent one) pre-fills the form so
  // a returning customer never has to type their address again.
  const initialAddress = addresses.find((address) => address.isDefault) ?? addresses[0] ?? null
  const [selectedAddressId, setSelectedAddressId] = React.useState<string | null>(
    initialAddress?.id ?? null
  )
  const selectedAddress = addresses.find((address) => address.id === selectedAddressId) ?? null
  const deliveryFormRef = React.useRef<HTMLFormElement>(null)

  const [step, setStep] = React.useState<'delivery' | 'review'>('delivery')
  const [details, setDetails] = React.useState<DeliveryDetails | null>(null)
  const [discountTotal, setDiscountTotal] = React.useState(0)
  const [couponFeedback, setCouponFeedback] = React.useState<string | null>(null)
  const [confirmed, setConfirmed] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [pendingChannel, setPendingChannel] = React.useState<Channel | null>(null)
  const [error, setError] = React.useState('')
  const [idempotencyKey, setIdempotencyKey] = React.useState('')

  const total = Math.max(0, subtotal - discountTotal + deliveryFee)

  // Field defaults: once the customer has reviewed their details, coming back
  // with « Modifier » must show exactly what they typed — not the original
  // prefill. Before that, use the selected saved address, then the profile.
  const defaults = {
    customerName:
      details?.customerName ??
      (selectedAddress ? addressFullName(selectedAddress) : prefillName) ??
      '',
    phone: details?.phone ?? selectedAddress?.phone ?? prefillPhone ?? '',
    city: details?.city ?? selectedAddress?.city ?? '',
    address: details?.address ?? selectedAddress?.address ?? '',
    clientEmail: details?.clientEmail ?? prefillEmail ?? '',
    couponCode: details?.couponCode ?? '',
    note: details?.note ?? '',
  }

  /**
   * Switching between saved addresses fills the fields in place (the coupon
   * and note the customer already typed are kept). « Nouvelle adresse »
   * clears the location fields but keeps the profile name/phone.
   */
  function handleAddressChange(id: string) {
    setSelectedAddressId(id || null)
    const address = addresses.find((candidate) => candidate.id === id) ?? null
    const form = deliveryFormRef.current
    if (!form) return

    const setValue = (name: string, value: string) => {
      const field = form.elements.namedItem(name)
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        field.value = value
      }
    }
    setValue('customerName', address ? addressFullName(address) : prefillName ?? '')
    setValue('phone', formatMoroccanPhone(address?.phone ?? prefillPhone ?? ''))
    setValue('city', address?.city ?? '')
    setValue('address', address?.address ?? '')
  }

  async function handleDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const phone = normalizeMoroccanPhone(String(formData.get('phone') ?? ''))
    const city = String(formData.get('city') ?? '').trim()
    const address = String(formData.get('address') ?? '').trim()
    const couponCode = String(formData.get('couponCode') ?? '').trim()

    if (!phone) {
      setError('Saisissez un numéro marocain valide, par exemple 06 12 34 56 78.')
      return
    }
    if (!city) {
      setError('Saisissez votre ville.')
      return
    }
    if (address.length < 10) {
      setError('Précisez votre adresse : quartier et rue.')
      return
    }

    setError('')
    setPending(true)

    let discount = 0
    if (couponCode) {
      try {
        const couponRes = await validateCouponAction(couponCode, subtotal)
        if (couponRes.ok) {
          discount = couponRes.discountAmount
          setCouponFeedback(couponRes.message)
        } else {
          setError(couponRes.message)
          setPending(false)
          return
        }
      } catch {
        // Non-blocking fallback
      }
    } else {
      setCouponFeedback(null)
    }

    setDiscountTotal(discount)
    setDetails({
      customerName: String(formData.get('customerName') ?? '').trim(),
      phone,
      city,
      address,
      clientEmail: String(formData.get('clientEmail') ?? '').trim(),
      couponCode,
      note: String(formData.get('note') ?? '').trim(),
    })
    setConfirmed(false)
    setIdempotencyKey(newIdempotencyKey())
    setPending(false)
    setStep('review')
    window.scrollTo({ top: 0 })
  }

  async function submitOrder(channel: Channel) {
    if (!details || pendingChannel) return
    if (!confirmed) {
      setError('Merci de cocher la case pour confirmer vos informations.')
      return
    }

    // The WhatsApp tab is opened on the click itself so mobile browsers don't
    // block it while the order is being saved server-side.
    const waWindow = channel === 'whatsapp' ? window.open('', '_blank') : null
    if (waWindow) waWindow.opener = null

    const openWhatsApp = (reference: string | null, failed: boolean) => {
      if (!waWindow || !details) return
      waWindow.location.href = buildWhatsAppUrl({
        settings,
        details,
        items,
        subtotal,
        deliveryFee,
        total,
        reference,
        failed,
      })
    }

    setPendingChannel(channel)
    setError('')

    const formData = new FormData()
    formData.set('customerName', details.customerName)
    formData.set('phone', details.phone)
    formData.set('city', details.city)
    formData.set('address', details.address)
    formData.set('clientEmail', details.clientEmail)
    formData.set('couponCode', details.couponCode)
    formData.set('note', details.note)
    formData.set('confirmInfo', 'on')
    formData.set('idempotencyKey', idempotencyKey)
    formData.set('channel', channel)
    // Which saved address was used, so the server updates that exact row.
    formData.set('addressId', selectedAddressId ?? '')
    formData.set(
      'items',
      JSON.stringify(items.map(({ slug, color, size, quantity }) => ({ slug, color, size, quantity })))
    )

    try {
      const result = await placeOrderAction(formData)

      if (!result.ok) {
        setError(result.error)
        // Never lose a sale: the WhatsApp tab still carries the whole order.
        openWhatsApp(null, true)
        return
      }

      openWhatsApp(result.orderNumber, false)
      clearCart()

      const token = result.trackingToken || result.orderNumber
      if (token) {
        router.push(`/confirmation/${encodeURIComponent(token)}`)
      } else if (!waWindow) {
        setError('La commande a été créée mais le lien de suivi est indisponible.')
      }
    } catch (failure) {
      console.error('[checkout] confirmation failed', failure)
      setError(
        'Impossible de joindre le serveur. Vérifiez votre connexion, réessayez ou envoyez la commande sur WhatsApp.'
      )
      openWhatsApp(null, true)
    } finally {
      setPendingChannel(null)
    }
  }

  if (!ready) {
    return <p className="py-12 text-center text-sm text-text-muted">Chargement du panier…</p>
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
            ref={deliveryFormRef}
            onSubmit={handleDetails}
            className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-hairline md:p-7"
          >
            <h2 className="text-heading text-ink">Informations de livraison</h2>
            <p className="mt-1 text-sm text-text-muted">
              Paiement en espèces à la réception. Aucun paiement en ligne n’est demandé.
            </p>

            <div className="mt-6 grid gap-4">
              {signedIn && addresses.length > 0 && (
                <label className={labelClassName}>
                  Mes adresses enregistrées
                  <select
                    value={selectedAddressId ?? ''}
                    onChange={(event) => handleAddressChange(event.currentTarget.value)}
                    className={fieldClassName}
                  >
                    {addresses.map((address) => (
                      <option key={address.id} value={address.id}>
                        {address.label} — {address.city}
                      </option>
                    ))}
                    <option value="">Nouvelle adresse…</option>
                  </select>
                  <span className="text-xs font-normal text-text-muted">
                    Pré-remplie depuis votre compte. Modifiez-la si besoin : elle sera
                    mise à jour pour vos prochaines commandes.{' '}
                    <Link href="/compte?mode=adresses" className="underline">
                      Gérer mes adresses
                    </Link>
                  </span>
                </label>
              )}
              <label className={labelClassName}>
                Nom complet
                <input
                  name="customerName"
                  autoComplete="name"
                  defaultValue={defaults.customerName}
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
                  defaultValue={defaults.phone ? formatMoroccanPhone(defaults.phone) : ''}
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
                Ville
                <input
                  name="city"
                  autoComplete="address-level2"
                  defaultValue={defaults.city}
                  placeholder="Kenitra"
                  required
                  maxLength={100}
                  className={fieldClassName}
                />
              </label>
              <label className={labelClassName}>
                Adresse complète (quartier, rue)
                <textarea
                  name="address"
                  autoComplete="street-address"
                  defaultValue={defaults.address}
                  required
                  minLength={10}
                  maxLength={500}
                  rows={3}
                  className={fieldClassName}
                />
                {signedIn && addresses.length === 0 && (
                  <span className="text-xs font-normal text-text-muted">
                    Cette adresse sera enregistrée dans votre compte pour vos
                    prochaines commandes.
                  </span>
                )}
              </label>
              <label className={labelClassName}>
                Email <span className="font-normal text-text-muted">(facultatif)</span>
                <input
                  name="clientEmail"
                  type="email"
                  autoComplete="email"
                  defaultValue={defaults.clientEmail}
                  maxLength={254}
                  className={fieldClassName}
                />
              </label>
              <label className={labelClassName}>
                Code de réduction
                <input
                  name="couponCode"
                  placeholder="BIENVENUE10"
                  defaultValue={defaults.couponCode}
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
                  defaultValue={defaults.note}
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

            <Button type="submit" size="lg" className="mt-6 w-full" disabled={pending} isLoading={pending}>
              {pending ? 'Vérification…' : 'Vérifier ma commande'}
            </Button>
          </form>

          <OrderSummary
            items={items}
            subtotal={subtotal}
            deliveryFee={deliveryFee}
            total={total}
            discountTotal={discountTotal}
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
                  { label: 'Ville', value: details.city },
                  { label: 'Téléphone', value: formatMoroccanPhone(details.phone) },
                  { label: 'Adresse', value: details.address },
                  ...(details.clientEmail
                    ? [{ label: 'Email', value: details.clientEmail }]
                    : []),
                  ...(details.couponCode
                    ? [
                        {
                          label: 'Code promo',
                          value: `${details.couponCode.toUpperCase()}${couponFeedback ? ` (${couponFeedback})` : ''}`,
                        },
                      ]
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

            <form
              onSubmit={(event) => {
                event.preventDefault()
                void submitOrder('site')
              }}
              className="mt-5"
            >
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
                  Je confirme que mon nom, mon numéro de téléphone, ma ville et mon adresse sont exacts.
                  La commande sera préparée avec ces informations.
                </span>
              </label>

              {error && (
                <div role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200">
                  <p>{error}</p>
                  {details && (
                    <a
                      href={buildWhatsAppUrl({
                        settings,
                        details,
                        items,
                        subtotal,
                        deliveryFee,
                        total,
                        reference: null,
                        failed: true,
                      })}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 font-medium text-rose-900 underline"
                    >
                      <MessageCircle size={14} /> Envoyer ma commande sur WhatsApp
                    </a>
                  )}
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="mt-4 w-full"
                isLoading={pendingChannel === 'site'}
                disabled={pendingChannel !== null || !confirmed}
              >
                {pendingChannel === 'site'
                  ? 'Enregistrement…'
                  : `Confirmer ma commande · ${formatMAD(total)}`}
              </Button>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-text-muted">
                <ShieldCheck size={13} /> Prix et frais de livraison revérifiés côté serveur.
              </p>

              <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-text-muted">
                <span className="h-px flex-1 bg-hairline" />
                ou
                <span className="h-px flex-1 bg-hairline" />
              </div>

              <button
                type="button"
                onClick={() => void submitOrder('whatsapp')}
                disabled={pendingChannel !== null || !confirmed}
                className="press inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full border-2 border-[#25D366] bg-white px-6 text-[15px] font-semibold text-[#128C4A] transition-colors hover:bg-[#25D366]/10 disabled:pointer-events-none disabled:opacity-40"
              >
                {pendingChannel === 'whatsapp' ? (
                  <span>Ouverture de WhatsApp…</span>
                ) : (
                  <>
                    <MessageCircle size={18} /> Commander sur WhatsApp
                  </>
                )}
              </button>
              <p className="mt-2 text-center text-[11px] leading-relaxed text-text-muted">
                Même commande, même prix : elle est enregistrée chez nous et envoyée à l’équipe sur
                WhatsApp, avec vos coordonnées complètes.
              </p>
            </form>
          </section>

          <OrderSummary
            items={items}
            subtotal={subtotal}
            deliveryFee={deliveryFee}
            total={total}
            discountTotal={discountTotal}
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
      {discountTotal > 0 && (
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
