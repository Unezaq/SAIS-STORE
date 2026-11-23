import { describe, expect, it } from 'vitest'
import { assessOrderRisk, riskLevelForScore, summarizeRisks } from '@/lib/risk'
import type { StoreOrder } from '@/lib/types/store'

function makeOrder(overrides: Partial<StoreOrder> = {}): StoreOrder {
  return {
    id: 'ord-1',
    customerName: 'Salma Test',
    phone: '+212600000001',
    city: 'Kenitra',
    address: 'Rue 1',
    items: [{ slug: 'pyjama', title: 'Pyjama', quantity: 1, price: 259 }],
    subtotal: 259,
    discountTotal: 0,
    deliveryFee: 22,
    total: 281,
    paymentMethod: 'cod',
    paymentStatus: 'unpaid',
    status: 'en_attente',
    createdAt: '2026-11-23T10:00:00.000Z',
    ...overrides,
  }
}

describe('riskLevelForScore', () => {
  it('maps scores to three readable levels', () => {
    expect(riskLevelForScore(0)).toBe('faible')
    expect(riskLevelForScore(2)).toBe('faible')
    expect(riskLevelForScore(3)).toBe('moyen')
    expect(riskLevelForScore(6)).toBe('moyen')
    expect(riskLevelForScore(7)).toBe('eleve')
  })
})

describe('assessOrderRisk', () => {
  it('keeps a small first order at low risk with an explicit reason', () => {
    const order = makeOrder()
    const risk = assessOrderRisk(order, [order])
    expect(risk.level).toBe('faible')
    expect(risk.reasons).toContain('Première commande avec ce numéro')
  })

  it('flags a phone with cancelled orders', () => {
    const cancelled = makeOrder({
      id: 'ord-0',
      status: 'annulee',
      createdAt: '2026-11-01T10:00:00.000Z',
    })
    const order = makeOrder()
    const risk = assessOrderRisk(order, [cancelled, order])
    expect(risk.score).toBeGreaterThanOrEqual(3)
    expect(risk.reasons.join(' ')).toContain('annulée')
    expect(risk.level).not.toBe('faible')
  })

  it('raises the level for a high cash amount', () => {
    const order = makeOrder({ subtotal: 1099, total: 1121 })
    const risk = assessOrderRisk(order, [order])
    expect(risk.level).toBe('moyen')
    expect(risk.reasons.join(' ')).toContain('1 000 MAD')
  })

  it('detects two orders on the same number within 24h', () => {
    const earlier = makeOrder({ id: 'ord-0', createdAt: '2026-11-23T02:00:00.000Z' })
    const order = makeOrder()
    const risk = assessOrderRisk(order, [earlier, order])
    expect(risk.reasons.join(' ')).toContain('moins de 24 h')
  })

  it('does not punish a repeat customer already delivered', () => {
    const delivered = makeOrder({
      id: 'ord-0',
      status: 'livree',
      createdAt: '2026-10-01T10:00:00.000Z',
    })
    const risk = assessOrderRisk(makeOrder(), [delivered, makeOrder()])
    expect(risk.reasons.join(' ')).toContain('déjà livrée')
    expect(risk.level).toBe('faible')
  })

  it('ignores orders created after the assessed one', () => {
    const later = makeOrder({ id: 'ord-9', createdAt: '2026-12-01T10:00:00.000Z' })
    const order = makeOrder()
    const risk = assessOrderRisk(order, [order, later])
    expect(risk.reasons.join(' ')).toContain('Première commande')
  })

  it('summarises the open orders by level', () => {
    const risky = makeOrder({
      id: 'ord-2',
      status: 'annulee',
      createdAt: '2026-11-01T10:00:00.000Z',
    })
    const cancelledTwice = makeOrder({
      id: 'ord-3',
      status: 'annulee',
      createdAt: '2026-11-02T10:00:00.000Z',
    })
    const cancelledThrice = makeOrder({
      id: 'ord-4',
      status: 'annulee',
      createdAt: '2026-11-03T10:00:00.000Z',
    })
    const current = makeOrder()
    const summary = summarizeRisks([current], [risky, cancelledTwice, cancelledThrice, current])
    expect(summary.counts.eleve).toBe(1)
    expect(summary.highRisk[0]?.order.id).toBe('ord-1')
  })
})
