/**
 * lib/orderStatus.ts — the order lifecycle, shared by the storefront, the
 * customer account and the admin dashboard so every screen speaks the same
 * language.
 *
 * en_attente → confirmee → expediee → livree
 *      ↘ annulee (at any point)
 */

export const ORDER_STATUSES = [
  'en_attente',
  'confirmee',
  'expediee',
  'livree',
  'annulee',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** The happy path, used by the timeline. */
export const ORDER_FLOW: OrderStatus[] = [
  'en_attente',
  'confirmee',
  'expediee',
  'livree',
]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  en_attente: 'En attente',
  confirmee: 'Confirmée',
  expediee: 'Expédiée',
  livree: 'Livrée',
  annulee: 'Annulée',
}

export const ORDER_STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  en_attente: 'Commande reçue — nous vous appelons pour la confirmer.',
  confirmee: 'Confirmée par téléphone, en préparation.',
  expediee: 'En route vers votre adresse.',
  livree: 'Livrée et réglée à la réception.',
  annulee: 'Cette commande a été annulée.',
}

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  en_attente: 'bg-amber-50 text-amber-700 ring-amber-200',
  confirmee: 'bg-sky-50 text-sky-700 ring-sky-200',
  expediee: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  livree: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  annulee: 'bg-rose-50 text-rose-700 ring-rose-200',
}

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value)
}

/** Position in the happy path; -1 for a cancelled order. */
export function orderStepIndex(status: OrderStatus): number {
  return ORDER_FLOW.indexOf(status)
}

const REFERENCE_PREFIX = 'SAIS'

/**
 * A short, readable reference a customer can read aloud on the phone.
 * Derived from the order id, so no extra column is needed: `SAIS-3F8A21C9`.
 */
export function orderReference(orderId: string): string {
  const compact = orderId.replace(/[^a-z0-9]/gi, '').toUpperCase()
  return `${REFERENCE_PREFIX}-${compact.slice(-8)}`
}

/** Accepts "sais-3f8a21c9", "#3F8A21C9" or a full order id. */
export function normalizeOrderReference(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/^#/, '')
    .replace(new RegExp(`^${REFERENCE_PREFIX}-?`), '')
    .replace(/[^A-Z0-9]/g, '')
}
