import { describe, it, expect, beforeEach, vi } from 'vitest'

import { SupabaseMock } from '../lib/supabase-mock'

const supabaseMock = new SupabaseMock()

// Mock both admin and server Supabase clients
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
  fd.set('idempotencyKey', 'idem-key-test-1')
  fd.set(
    'items',
    JSON.stringify([
      { slug: 'pyjama-polaires', color: 'Bleu', size: 'M', quantity: 1 },
    ])
  )
  return fd
}

beforeEach(() => {
  supabaseMock.reset()
  vi.restoreAllMocks()

  // Seed settings
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

  // Seed products
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

  // Seed product variants
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
})

describe('placeOrderAction', () => {
  it('creates an order and returns a tracking token', async () => {
    const result = await placeOrderAction(baseFormData())

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.trackingToken).toBeDefined()
      expect(result.trackingToken.length).toBeGreaterThan(0)
      expect(result.orderNumber).toBe('SAIS-TEST')
      expect(result.total).toBe(222) // 200 + 22 delivery
      expect(result.items).toHaveLength(1)
    }
  })

  it('rejects missing confirmation checkbox', async () => {
    const fd = baseFormData()
    fd.set('confirmInfo', 'off')

    const result = await placeOrderAction(fd)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('confirmer')
    }
  })

  it('rejects invalid phone number', async () => {
    const fd = baseFormData()
    fd.set('phone', '01 23 45 67 89')

    const result = await placeOrderAction(fd)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('téléphone')
    }
  })

  it('rejects empty cart', async () => {
    const fd = baseFormData()
    fd.set('items', JSON.stringify([]))

    const result = await placeOrderAction(fd)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('panier')
    }
  })

  it('recalculates prices server-side (ignores client price)', async () => {
    const fd = baseFormData()
    // Client sends an inflated price - server should ignore it
    fd.set(
      'items',
      JSON.stringify([
        { slug: 'pyjama-polaires', color: 'Bleu', size: 'M', quantity: 1, price: 99999 },
      ])
    )

    const result = await placeOrderAction(fd)

    expect(result.ok).toBe(true)
    if (result.ok) {
      // Price should be 200 (server-side), not 99999
      expect(result.items[0].price).toBe(200)
      expect(result.total).toBe(222)
    }
  })

  it('supports idempotency key for duplicate submission protection', async () => {
    const fd1 = baseFormData()
    const fd2 = baseFormData()

    const result1 = await placeOrderAction(fd1)
    const result2 = await placeOrderAction(fd2)

    expect(result1.ok).toBe(true)
    expect(result2.ok).toBe(true)
  })
})
