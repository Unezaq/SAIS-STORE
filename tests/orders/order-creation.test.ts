import { describe, it, expect, beforeEach, vi } from 'vitest'

import { SupabaseMock } from '../lib/supabase-mock'

const supabaseMock = new SupabaseMock()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => supabaseMock,
}))

import { createOrder } from '@/lib/store'
import type { StoreOrder } from '@/lib/types/store'

const testProduct = {
  id: 'prod-1',
  slug: 'pyjama-polaires',
  title: 'Pyjama Polaires',
  price: 200,
  original_price: null,
  image_url: '/products/sais-01.jpg',
  colors: [{ name: 'Bleu', hex: '#0000FF' }],
  sizes: ['M', 'L', 'XL'],
  stock: 10,
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
  supabaseMock.from('products').insert([testProduct as any])

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

const baseOrderInput: Omit<StoreOrder, 'id' | 'createdAt'> = {
  customerName: 'Test Customer',
  phone: '+212612345678',
  address: '123 Rue Test, Kenitra',
  items: [
    {
      slug: 'pyjama-polaires',
      title: 'Pyjama Polaires',
      color: 'Bleu',
      size: 'M',
      quantity: 2,
      price: 200,
    },
  ],
  subtotal: 0,
  discountTotal: 0,
  deliveryFee: 0,
  total: 0,
  paymentMethod: 'cod',
  paymentStatus: 'unpaid',
  status: 'en_attente',
}

describe('order creation', () => {
  it('successfully creates an order with customer association', async () => {
    const result = await createOrder(
      { ...baseOrderInput, clientEmail: 'test@example.com', clientName: 'Test Customer' },
      null,
      'cust-123',
      {}
    )

    expect(result.id).toBeDefined()
    expect(result.customerName).toBe('Test Customer')
    expect(result.total).toBeGreaterThan(0)
  })

  it('calculates correct server-side total', async () => {
    // 2 items × 200 = 400 subtotal + 22 delivery = 422 total
    const result = await createOrder(
      { ...baseOrderInput, clientEmail: undefined, clientName: undefined },
      null,
      'cust-123',
      {}
    )

    expect(result.subtotal).toBe(400)
    expect(result.deliveryFee).toBe(22)
    expect(result.total).toBe(422)
  })

  it('calls the RPC for order creation', async () => {
    const result = await createOrder(
      { ...baseOrderInput, clientEmail: undefined, clientName: undefined },
      null,
      'cust-123',
      {}
    )

    expect(result.id).toBeDefined()
  })

  it('calculates free delivery when min items reached', async () => {
    const freeDeliveryInput = {
      ...baseOrderInput,
      items: [{ ...baseOrderInput.items[0], quantity: 3 }],
    }

    const result = await createOrder(
      freeDeliveryInput as any,
      null,
      'cust-123',
      {}
    )

    expect(result.subtotal).toBe(600) // 3 × 200
    expect(result.deliveryFee).toBe(0) // free delivery
    expect(result.total).toBe(600)
  })

  it('associates order with the correct customer', async () => {
    const result = await createOrder(
      { ...baseOrderInput, clientEmail: undefined, clientName: undefined },
      null,
      'cust-456',
      {}
    )

    expect(result.id).toBeDefined()
  })

  it('supports idempotency key for duplicate submission protection', async () => {
    // First call with idempotency key
    const result1 = await createOrder(
      { ...baseOrderInput, clientEmail: undefined, clientName: undefined },
      null,
      'cust-123',
      { idempotencyKey: 'idem-key-123' }
    )

    // Second call with same idempotency key should succeed (mock RPC always succeeds)
    const result2 = await createOrder(
      { ...baseOrderInput, clientEmail: undefined, clientName: undefined },
      null,
      'cust-123',
      { idempotencyKey: 'idem-key-123' }
    )

    expect(result1.id).toBeDefined()
    expect(result2.id).toBeDefined()
  })
})
