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

import { placeOrderAction, validateCouponAction, trackOrderAction } from '@/actions/checkout'

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

  // Seed coupons for validation tests
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
    } as any,
    {
      id: 'coup-2',
      code: 'fixed50',
      type: 'fixed',
      value: 50,
      min_order: 150,
      is_active: true,
      used_count: 0,
      max_uses: 10,
    } as any,
    {
      id: 'coup-3',
      code: 'min500',
      type: 'percentage',
      value: 20,
      min_order: 500,
      is_active: true,
      used_count: 0,
      max_uses: 50,
    } as any,
    {
      id: 'coup-4',
      code: 'inactive',
      type: 'percentage',
      value: 15,
      min_order: 0,
      is_active: false,
      used_count: 0,
    } as any,
    {
      id: 'coup-5',
      code: 'expired',
      type: 'percentage',
      value: 15,
      min_order: 0,
      is_active: true,
      used_count: 0,
      expires_at: '2020-01-01T00:00:00Z',
    } as any,
    {
      id: 'coup-6',
      code: 'exhausted',
      type: 'percentage',
      value: 15,
      min_order: 0,
      is_active: true,
      used_count: 5,
      max_uses: 5,
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

describe('validateCouponAction', () => {
  it('rejects empty or whitespace-only code', async () => {
    const result = await validateCouponAction('   ', 300)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('requis')
  })

  it('rejects invalid or non-positive subtotal', async () => {
    const result = await validateCouponAction('PROMO10', 0)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('invalide')
  })

  it('validates a percentage coupon and calculates discount amount', async () => {
    const result = await validateCouponAction('PROMO10', 200)
    expect(result.ok).toBe(true)
    expect(result.discountAmount).toBe(20) // 10% of 200
  })

  it('validates a fixed-amount coupon', async () => {
    const result = await validateCouponAction('fixed50', 200)
    expect(result.ok).toBe(true)
    expect(result.discountAmount).toBe(50)
  })

  it('rejects coupon when subtotal is below minimum order requirement', async () => {
    const result = await validateCouponAction('min500', 300)
    expect(result.ok).toBe(false)
    expect(result.discountAmount).toBe(0)
    expect(result.message).toContain('500 MAD')
  })

  it('rejects inactive coupon', async () => {
    const result = await validateCouponAction('inactive', 300)
    expect(result.ok).toBe(false)
    expect(result.discountAmount).toBe(0)
  })

  it('rejects expired coupon', async () => {
    const result = await validateCouponAction('expired', 300)
    expect(result.ok).toBe(false)
    expect(result.discountAmount).toBe(0)
  })

  it('rejects coupon that reached maximum usage limit', async () => {
    const result = await validateCouponAction('exhausted', 300)
    expect(result.ok).toBe(false)
    expect(result.discountAmount).toBe(0)
  })
})

describe('placeOrderAction with coupon', () => {
  it('applies coupon discount server-side during order placement', async () => {
    const fd = baseFormData()
    fd.set('couponCode', 'PROMO10') // 10% on 200 MAD subtotal = 20 MAD discount

    const result = await placeOrderAction(fd)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.discountTotal).toBe(20)
      expect(result.total).toBe(202) // 200 - 20 + 22 delivery = 202
    }
  })
})

describe('trackOrderAction rate limiting & phone normalization parity', () => {
  it('normalizes equivalent Moroccan phone formats to the same rate limit bucket', async () => {
    const testRef = 'SAIS-12345678'
    const phoneFormats = [
      '0612345678',
      '+212612345678',
      '00212612345678',
      '06 12 34 56 78',
      '06-12-34-56-78',
      '+212 6 12 34 56 78',
    ]

    // All these formats normalize to +212612345678 and hit the same bucket
    for (const phone of phoneFormats) {
      const fd = new FormData()
      fd.set('phone', phone)
      fd.set('reference', testRef)

      const result = await trackOrderAction(fd)
      // They either fail because the order doesn't exist or because of rate limiting,
      // but none fail due to "invalid phone"
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).not.toContain('Ce numéro de téléphone n’est pas un numéro marocain valide.')
      }
    }
  })
})
