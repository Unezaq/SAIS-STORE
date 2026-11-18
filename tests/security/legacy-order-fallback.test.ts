import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createAdminClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

import { getOrderForCustomerOrLegacy } from '@/lib/store'

describe('legacy customer order lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not perform an unscoped fallback without an auth user ID', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: '42703',
          message: 'column orders.customer_id does not exist',
        },
      }),
    }
    const from = vi.fn(() => query)
    createAdminClientMock.mockReturnValue({ from })

    await expect(
      getOrderForCustomerOrLegacy('order-1', 'customer-1', null)
    ).resolves.toBeNull()
    expect(from).toHaveBeenCalledTimes(1)
  })

  it('limits the legacy fallback to the verified auth user', async () => {
    const filters: Array<[string, string]> = []
    let queryCount = 0
    let lookupCount = 0
    const from = vi.fn(() => {
      queryCount += 1
      const query = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((column: string, value: string) => {
          filters.push([column, value])
          return query
        }),
        or: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(() => {
          lookupCount += 1
          return lookupCount === 1
            ? Promise.resolve({
                data: null,
                error: {
                  code: '42703',
                  message: 'column orders.customer_id does not exist',
                },
              })
            : Promise.resolve({
                data: {
                  id: 'order-1',
                  customer_name: 'Customer',
                  phone: '+212600000000',
                  address: 'Address',
                  items: [],
                  subtotal: 100,
                  discount_total: 0,
                  delivery_fee: 20,
                  total: 120,
                  status: 'en_attente',
                  created_at: '2026-01-01T00:00:00Z',
                },
                error: null,
              })
        }),
      }
      return query
    })
    createAdminClientMock.mockReturnValue({ from })

    const order = await getOrderForCustomerOrLegacy(
      'order-1',
      'customer-1',
      'auth-user-1'
    )

    expect(order?.id).toBe('order-1')
    expect(queryCount).toBe(2)
    expect(filters).toEqual([
      ['id', 'order-1'],
      ['id', 'order-1'],
      ['auth_user_id', 'auth-user-1'],
    ])
  })
})
