/**
 * lib/orderStatus.ts — the order lifecycle, shared by the storefront, the
 * customer account and the admin dashboard so every screen speaks the same
 * language.
 *
 * en_attente → confirmee → expediee → livree
 *      ↘ annulee (before expediee)
 * livree → returned (partial or full)
 * returned → refunded (when money is reimbursed)
 */

export const ORDER_STATUSES = [
  'en_attente',
  'confirmee',
  'expediee',
  'livree',
  'annulee',
  'returned',
  'refunded',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** The happy path, used by the timeline. */
export const ORDER_FLOW: OrderStatus[] = [
  'en_attente',
  'confirmee',
  'expediee',
  'livree',
]

/** Terminal / non-happy-path statuses. */
export const TERMINAL_STATUSES: OrderStatus[] = ['annulee', 'returned', 'refunded']

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  en_attente: 'En attente',
  confirmee: 'Confirmée',
  expediee: 'Expédiée',
  livree: 'Livrée',
  annulee: 'Annulée',
  returned: 'Retournée',
  refunded: 'Remboursée',
}

export const ORDER_STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  en_attente: 'Commande reçue — nous vous appelons pour la confirmer.',
  confirmee: 'Confirmée par téléphone, en préparation.',
  expediee: 'En route vers votre adresse.',
  livree: 'Livrée et réglée à la réception.',
  annulee: 'Cette commande a été annulée.',
  returned: 'Cette commande a été retournée et le stock restitué.',
  refunded: 'Cette commande a été remboursée.',
}

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  en_attente: 'bg-amber-50 text-amber-700 ring-amber-200',
  confirmee: 'bg-sky-50 text-sky-700 ring-sky-200',
  expediee: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  livree: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  annulee: 'bg-rose-50 text-rose-700 ring-rose-200',
  returned: 'bg-rose-100 text-rose-800 ring-rose-200',
  refunded: 'bg-slate-100 text-slate-800 ring-slate-200',
}

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value)
}

/** Position in the happy path; -1 for a cancelled or returned order. */
export function orderStepIndex(status: OrderStatus): number {
  return ORDER_FLOW.indexOf(status)
}

/** Whether a status is terminal (no further normal transitions). */
export function isTerminalStatus(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

/** Whether stock should be restored when moving to this status. */
export function restocksStock(status: OrderStatus): boolean {
  return status === 'annulee' || status === 'returned'
}

/** Whether the order can be cancelled (customer-initiated). */
export function isCancellable(status: OrderStatus): boolean {
  return status === 'en_attente' || status === 'confirmee'
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
