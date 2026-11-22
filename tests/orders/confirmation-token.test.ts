import { describe, it, expect, beforeEach, vi } from 'vitest'

import { SupabaseMock } from '../lib/supabase-mock'

const supabaseMock = new SupabaseMock()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => supabaseMock,
}))

import { getOrderByToken } from '@/lib/store'

beforeEach(() => {
  supabaseMock.reset()
  vi.restoreAllMocks()

  // Seed an order with a tracking token
  supabaseMock.from('orders').insert([
    {
      id: 'ord-test-123',
      order_number: 'SAIS-TEST123',
      tracking_token: 'tok-abc123def456',
      customer_name: 'Test Customer',
      phone: '+212612345678',
      city: 'Kenitra',
      address: '123 Rue Test, Kenitra',
      items: [
        { slug: 'pyjama-polaires', title: 'Pyjama Polaires', color: 'Bleu', size: 'M', quantity: 1, price: 200 },
      ],
      subtotal: 200,
      discount_total: 0,
      delivery_fee: 22,
      total: 222,
      status: 'en_attente',
      payment_method: 'cod',
      payment_status: 'unpaid',
      created_at: '2026-11-22T10:00:00Z',
      updated_at: '2026-11-22T10:00:00Z',
    } as any,
  ])
})

describe('getOrderByToken', () => {
  it('returns the order for a valid tracking token', async () => {
    const order = await getOrderByToken('tok-abc123def456')

    expect(order).not.toBeNull()
    if (order) {
      expect(order.orderNumber).toBe('SAIS-TEST123')
      expect(order.status).toBe('en_attente')
      expect(order.total).toBe(222)
      expect(order.items).toHaveLength(1)
    }
  })

  it('returns null for an invalid tracking token', async () => {
    const order = await getOrderByToken('invalid-token')

    expect(order).toBeNull()
  })

  it('returns null for an empty token', async () => {
    const order = await getOrderByToken('')

    expect(order).toBeNull()
  })
})
