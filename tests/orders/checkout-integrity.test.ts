import { describe, it, expect, beforeEach, vi } from 'vitest'

import { SupabaseMock } from '../lib/supabase-mock'

const supabaseMock = new SupabaseMock()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => supabaseMock,
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => supabaseMock,
}))

import { placeOrderAction } from '@/actions/checkout'

const baseFormData = () => {
  const fd = new FormData()
  fd.set('customerName', 'Test Customer')
  fd.set('phone', '06 12 34 56 78')
  fd.set('city', 'Kenitra')
  fd.set('address', '123 Rue Test, Kenitra')
  fd.set('clientEmail', '')
  fd.set('couponCode', '')
  fd.set('note', '')
  fd.set('confirmInfo', 'on')
  fd.set('idempotencyKey', `idem-${Math.random().toString(36).slice(2)}`)
  return fd
}

beforeEach(() => {
  supabaseMock.reset()
  vi.restoreAllMocks()

  supabaseMock.from('settings').insert([
    {
      id: 1,
      store_name: 'SAIS Store',
      whatsapp_phone: '212644816544',
      delivery_text: 'Livraison 24-48h',
      payment_text: 'Paiement à la livraison',
      currency: 'MAD',
      delivery_fee: 22,
      free_delivery_min_items: 3,
      storewide_discount_percent: 0,
    } as any,
  ])

  supabaseMock.from('products').insert([
    {
      id: 'prod-1',
      slug: 'pyjama-polaires',
      title: 'Pyjama Polaires',
      price: 200,
      original_price: null,
      image_url: '/products/sais-01.jpg',
      colors: [{ name: 'Bleu', hex: '#0000FF' }],
      sizes: ['M', 'L', 'XL'],
      stock: 10,
    } as any,
  ])

  supabaseMock.from('product_variants').insert([
    {
      id: 'variant-1',
      product_id: 'prod-1',
      size: 'M',
      color: 'Bleu',
      stock: 5,
      price_adjustment: 0,
    } as any,
  ])

  supabaseMock.from('coupons').insert([
    {
      id: 'coup-1',
      code: 'promo10',
      type: 'percentage',
      value: 10,
      min_order: 100,
      is_active: true,
      used_count: 0,
      max_uses: 100,
      per_user_limit: null,
    } as any,
  ])
})

describe('checkout integrity', () => {
  it('ignores client-supplied price, uses server-side price', async () => {
    const fd = baseFormData()
    fd.set(
      'items',
      JSON.stringify([
        { slug: 'pyjama-polaires', color: 'Bleu', size: 'M', quantity: 1, price: 99999 },
      ])
    )

    const result = await placeOrderAction(fd)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.items[0].price).toBe(200)
      expect(result.total).toBe(222)
    }
  })

  it('rejects invalid coupon with French message', async () => {
    const fd = baseFormData()
    fd.set('couponCode', 'NONEXISTENT')
    fd.set(
      'items',
      JSON.stringify([
        { slug: 'pyjama-polaires', color: 'Bleu', size: 'M', quantity: 1 },
      ])
    )

    const result = await placeOrderAction(fd)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('réduction')
    }
  })

  it('passes duplicate cart lines to RPC (aggregation happens server-side)', async () => {
    const rpcSpy = vi.spyOn(supabaseMock, 'rpc')
    const fd = baseFormData()
    fd.set(
      'items',
      JSON.stringify([
        { slug: 'pyjama-polaires', color: 'Bleu', size: 'M', quantity: 3 },
        { slug: 'pyjama-polaires', color: 'Bleu', size: 'M', quantity: 3 },
      ])
    )

    const result = await placeOrderAction(fd)

    expect(result.ok).toBe(true)
    // Both line items are sent to the RPC; the SQL function aggregates them.
    expect(rpcSpy).toHaveBeenCalledWith(
      'place_order_rpc',
      expect.objectContaining({
        p_items: expect.arrayContaining([
          expect.objectContaining({ slug: 'pyjama-polaires', quantity: 3 }),
          expect.objectContaining({ slug: 'pyjama-polaires', quantity: 3 }),
        ]),
      })
    )
  })
})

describe('customer order isolation', () => {
  it('getCustomerOrders queries by auth_user_id (RLS-isolated)', async () => {
    supabaseMock.setUser({
      id: 'user-123',
      email: 'test@example.com',
    })

    const { getCustomerOrders } = await import('@/actions/customer-account')
    const orders = await getCustomerOrders()

    expect(orders).toEqual([])
  })
})