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

const USER_ID = '11111111-1111-4111-8111-111111111111'
const ADDRESS_ID = '22222222-2222-4222-8222-222222222222'

const baseFormData = () => {
  const fd = new FormData()
  fd.set('customerName', 'Sara Amrani')
  fd.set('phone', '06 12 34 56 78')
  fd.set('city', 'Kenitra')
  fd.set('address', '12 Rue de la Liberté, Quartier Centre')
  fd.set('clientEmail', '')
  fd.set('couponCode', '')
  fd.set('note', '')
  fd.set('confirmInfo', 'on')
  fd.set('idempotencyKey', `idem-${Math.random().toString(36).slice(2)}`)
  fd.set(
    'items',
    JSON.stringify([{ slug: 'pyjama-polaires', color: 'Bleu', size: 'M', quantity: 1 }])
  )
  return fd
}

const savedAddress = (overrides: Record<string, unknown> = {}) => ({
  id: ADDRESS_ID,
  user_id: USER_ID,
  label: 'Domicile',
  first_name: 'Sara',
  last_name: 'Amrani',
  phone: '+212612345678',
  city: 'Kenitra',
  address: '12 Rue de la Liberté, Quartier Centre',
  is_default: true,
  created_at: '2026-11-20T10:00:00Z',
  updated_at: '2026-11-20T10:00:00Z',
  ...overrides,
})

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
})

describe('checkout address memory (signed-in customer)', () => {
  it('does not save any address for a guest order', async () => {
    const result = await placeOrderAction(baseFormData())

    expect(result.ok).toBe(true)
    expect(supabaseMock.getTableData('customer_addresses')).toHaveLength(0)
  })

  it('saves the delivery address as default on the first signed-in order', async () => {
    supabaseMock.setUser({ id: USER_ID, email: 'sara@example.com' })

    const result = await placeOrderAction(baseFormData())

    expect(result.ok).toBe(true)
    const rows = supabaseMock.getTableData('customer_addresses')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      user_id: USER_ID,
      first_name: 'Sara',
      last_name: 'Amrani',
      phone: '+212612345678',
      city: 'Kenitra',
      address: '12 Rue de la Liberté, Quartier Centre',
      is_default: true,
    })
  })

  it('does not duplicate the address when the same details are ordered again', async () => {
    supabaseMock.setUser({ id: USER_ID })
    supabaseMock.from('customer_addresses').insert([savedAddress()])

    const result = await placeOrderAction(baseFormData())

    expect(result.ok).toBe(true)
    expect(supabaseMock.getTableData('customer_addresses')).toHaveLength(1)
  })

  it('updates the picked saved address when the customer edits it at checkout', async () => {
    supabaseMock.setUser({ id: USER_ID })
    supabaseMock.from('customer_addresses').insert([savedAddress()])

    const fd = baseFormData()
    fd.set('addressId', ADDRESS_ID)
    fd.set('address', '45 Avenue Hassan II, Appartement 3')
    const result = await placeOrderAction(fd)

    expect(result.ok).toBe(true)
    const rows = supabaseMock.getTableData('customer_addresses')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: ADDRESS_ID,
      label: 'Domicile',
      address: '45 Avenue Hassan II, Appartement 3',
      is_default: true,
    })
  })

  it('keeps old addresses and makes a brand new one the default', async () => {
    supabaseMock.setUser({ id: USER_ID })
    supabaseMock.from('customer_addresses').insert([savedAddress()])

    const fd = baseFormData()
    fd.set('city', 'Rabat')
    fd.set('address', '8 Rue des Fleurs, Agdal')
    const result = await placeOrderAction(fd)

    expect(result.ok).toBe(true)
    const rows = supabaseMock.getTableData('customer_addresses')
    expect(rows).toHaveLength(2)

    const old = rows.find((row) => row.id === ADDRESS_ID)
    expect(old).toMatchObject({ city: 'Kenitra', is_default: false })

    const fresh = rows.find((row) => row.id !== ADDRESS_ID)
    expect(fresh).toMatchObject({ city: 'Rabat', address: '8 Rue des Fleurs, Agdal', is_default: true })
  })

  it('never fails the order when remembering the address breaks', async () => {
    supabaseMock.setUser({ id: USER_ID })
    const originalFrom = supabaseMock.from.bind(supabaseMock)
    vi.spyOn(supabaseMock, 'from').mockImplementation((table: string) => {
      if (table === 'customer_addresses') throw new Error('address book unavailable')
      return originalFrom(table)
    })

    const result = await placeOrderAction(baseFormData())

    expect(result.ok).toBe(true)
  })
})
