import type { StoreOrder } from '@/lib/types/store'

/**
 * lib/risk.ts — COD risk management.
 *
 * Morocco is a cash-on-delivery market: an order is not a sale until it is
 * delivered, and the phone number is the real identity. The score therefore
 * only looks at signals that live in the orders we already store — no extra
 * table, no external data:
 *   • cancelled orders on the same phone,
 *   • orders stacking up in less than 24 h,
 *   • pending duplicates on the same number,
 *   • cash amount at risk and unusual quantities,
 *   • a phone we have never seen.
 *
 * It is deliberately explainable: every point comes with a reason the admin can
 * read before calling the customer.
 */

export type RiskLevel = 'faible' | 'moyen' | 'eleve'

export interface OrderRisk {
  score: number
  level: RiskLevel
  reasons: string[]
  recommendation: string
}

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  faible: 'Faible',
  moyen: 'À vérifier',
  eleve: 'Élevé',
}

export const RISK_LEVEL_STYLES: Record<RiskLevel, string> = {
  faible: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  moyen: 'bg-amber-50 text-amber-700 ring-amber-200',
  eleve: 'bg-rose-50 text-rose-700 ring-rose-200',
}

const DAY_MS = 24 * 60 * 60 * 1000

export function riskLevelForScore(score: number): RiskLevel {
  if (score >= 7) return 'eleve'
  if (score >= 3) return 'moyen'
  return 'faible'
}

/**
 * `history` is the full order list; only orders on the same phone that existed
 * at the time of this order are considered, so the score never changes because
 * of a future order.
 */
export function assessOrderRisk(order: StoreOrder, history: StoreOrder[]): OrderRisk {
  const reasons: string[] = []
  let score = 0

  const createdAt = new Date(order.createdAt).getTime()
  const samePhone = history.filter(
    (entry) =>
      entry.id !== order.id &&
      entry.phone === order.phone &&
      new Date(entry.createdAt).getTime() <= createdAt
  )

  const cancelled = samePhone.filter((entry) => entry.status === 'annulee').length
  if (cancelled > 0) {
    score += Math.min(cancelled * 3, 9)
    reasons.push(
      `${cancelled} commande${cancelled > 1 ? 's' : ''} annulée${cancelled > 1 ? 's' : ''} avec ce numéro`
    )
  }

  const stacked = samePhone.filter(
    (entry) => createdAt - new Date(entry.createdAt).getTime() <= DAY_MS
  ).length
  if (stacked > 0) {
    score += 3
    reasons.push('Nouvelle commande moins de 24 h après une précédente')
  }

  const pendingDuplicates = samePhone.filter((entry) => entry.status === 'en_attente').length
  if (pendingDuplicates >= 2) {
    score += 2
    reasons.push(`${pendingDuplicates} autres commandes encore en attente avec ce numéro`)
  }

  if (order.total >= 1000) {
    score += 4
    reasons.push('Montant élevé en espèces à encaisser (1 000 MAD ou plus)')
  } else if (order.total >= 600) {
    score += 2
    reasons.push('Montant à encaisser supérieur à 600 MAD')
  }

  const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0)
  if (quantity >= 4) {
    score += 1
    reasons.push(`Quantité inhabituelle (${quantity} articles)`)
  }

  const returningCustomer = samePhone.some((entry) => entry.status === 'livree')
  if (samePhone.length === 0) {
    score += 1
    reasons.push('Première commande avec ce numéro')
  } else if (returningCustomer && cancelled === 0 && stacked === 0) {
    reasons.push('Cliente déjà livrée avec ce numéro')
  }

  const level = riskLevelForScore(score)

  if (reasons.length === 0) {
    reasons.push('Aucun signal de risque détecté')
  }

  const recommendation =
    level === 'eleve'
      ? 'Appelez, puis confirmez par WhatsApp avec l’adresse exacte. Demandez une avance ou une photo de l’adresse avant d’expédier.'
      : level === 'moyen'
        ? 'Appelez pour confirmer l’adresse avant l’expédition.'
        : 'Commande standard : confirmation par appel comme d’habitude.'

  return { score, level, reasons, recommendation }
}

export interface RiskSummary {
  counts: Record<RiskLevel, number>
  highRisk: Array<{ order: StoreOrder; risk: OrderRisk }>
}

/** Dashboard-level summary over the orders still in play. */
export function summarizeRisks(orders: StoreOrder[], history = orders): RiskSummary {
  const counts: Record<RiskLevel, number> = { faible: 0, moyen: 0, eleve: 0 }
  const highRisk: Array<{ order: StoreOrder; risk: OrderRisk }> = []

  for (const order of orders) {
    const risk = assessOrderRisk(order, history)
    counts[risk.level] += 1
    if (risk.level === 'eleve') highRisk.push({ order, risk })
  }

  return { counts, highRisk }
}
