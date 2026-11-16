import { describe, it, expect, beforeEach, vi } from 'vitest'

import { SupabaseMock } from '../lib/supabase-mock'

const supabaseMock = new SupabaseMock()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => supabaseMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => supabaseMock,
}))

import { getCustomerById } from '@/lib/auth/customers'
import { getOrdersByCustomerId, getOrderForCustomer } from '@/lib/store'
import { createCustomerRecord } from '@/lib/auth/customers'
import { hashPassword } from '@/lib/auth/password'
import type { CustomerRow } from '@/lib/auth/customers'

beforeEach(() => {
  supabaseMock.reset()
  vi.restoreAllMocks()
})

async function seedCustomers() {
  const hashA = await hashPassword('PassA123')
  const hashB = await hashPassword('PassB123')

  const customerA = await createCustomerRecord({
    fullName: 'Customer A',
    email: 'a@example.com',
    normalizedEmail: 'a@example.com',
    phone: '+212611111111',
    normalizedPhone: '+212611111111',
    city: 'Kenitra',
    address: '1 Rue A',
    passwordHash: hashA,
  })
  const customerB = await createCustomerRecord({
    fullName: 'Customer B',
    email: 'b@example.com',
    normalizedEmail: 'b@example.com',
    phone: '+212622222222',
    normalizedPhone: '+212622222222',
    city: 'Casablanca',
    address: '2 Rue B',
    passwordHash: hashB,
  })

  // Seed orders directly in mock
  supabaseMock.from('orders').insert([
    {
      id: 'order-a-1',
      customer_id: customerA.customer.id,
      customer_name: 'Customer A',
      phone: '+212611111111',
      address: '1 Rue A',
      items: [{ slug: 'prod-1', title: 'Product 1', quantity: 1, price: 100 }],
      subtotal: 100,
      discount_total: 0,
      delivery_fee: 22,
      total: 122,
      status: 'en_attente',
      created_at: new Date().toISOString(),
    } as any,
    {
      id: 'order-a-2',
      customer_id: customerA.customer.id,
      customer_name: 'Customer A',
      phone: '+212611111111',
      address: '1 Rue A',
      items: [{ slug: 'prod-2', title: 'Product 2', quantity: 2, price: 50 }],
      subtotal: 100,
      discount_total: 0,
      delivery_fee: 22,
      total: 122,
      status: 'livree',
      created_at: new Date().toISOString(),
    } as any,
    {
      id: 'order-b-1',
      customer_id: customerB.customer.id,
      customer_name: 'Customer B',
      phone: '+212622222222',
      address: '2 Rue B',
      items: [{ slug: 'prod-3', title: 'Product 3', quantity: 1, price: 200 }],
      subtotal: 200,
      discount_total: 0,
      delivery_fee: 22,
      total: 222,
      status: 'en_attente',
      created_at: new Date().toISOString(),
    } as any,
  ])

  return { customerA: customerA.customer, customerB: customerB.customer }
}

describe('customer data isolation', () => {
  it('Customer A and B have separate profiles', async () => {
    const { customerA, customerB } = await seedCustomers()

    const profileA = await getCustomerById(customerA.id)
    const profileB = await getCustomerById(customerB.id)

    expect(profileA?.id).toBe(customerA.id)
    expect(profileB?.id).toBe(customerB.id)
    expect(profileA?.email).toBe('a@example.com')
    expect(profileB?.email).toBe('b@example.com')
    expect(profileA?.id).not.toBe(profileB?.id)
  })

  it('Customer A only sees their own orders', async () => {
    const { customerA, customerB } = await seedCustomers()

    const ordersA = await getOrdersByCustomerId(customerA.id)
    const ordersB = await getOrdersByCustomerId(customerB.id)

    expect(ordersA.length).toBe(2)
    expect(ordersB.length).toBe(1)
    expect(ordersA.every((o) => o.customerName === 'Customer A')).toBe(true)
    expect(ordersB.every((o) => o.customerName === 'Customer B')).toBe(true)
  })

  it('Customer A cannot access Customer B order by ID', async () => {
    const { customerA, customerB } = await seedCustomers()

    const orderBForA = await getOrderForCustomer('order-b-1', customerA.id)
    expect(orderBForA).toBeNull()

    const orderAForA = await getOrderForCustomer('order-a-1', customerA.id)
    expect(orderAForA).not.toBeNull()
    expect(orderAForA?.id).toBe('order-a-1')
  })

  it('Customer B cannot access Customer A order by ID', async () => {
    const { customerA, customerB } = await seedCustomers()

    const orderAForB = await getOrderForCustomer('order-a-1', customerB.id)
    expect(orderAForB).toBeNull()
  })
})
