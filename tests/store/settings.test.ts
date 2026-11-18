import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

import { getSettings } from '@/lib/store'

describe('getSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses defaults for discount fields when the optional columns are missing', async () => {
    const settingsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValueOnce({
          data: null,
          error: {
            code: '42703',
            message:
              'column settings.storewide_discount_percent does not exist',
          },
        })
        .mockResolvedValueOnce({
          data: {
            id: 1,
            store_name: 'SAIS Store',
            whatsapp_phone: '212644816544',
            delivery_text: 'Livraison 24-48h',
            payment_text: 'Paiement à la livraison',
            currency: 'MAD',
            delivery_fee: 22,
            free_delivery_min_items: 3,
          },
          error: null,
        }),
    }

    createClientMock.mockResolvedValue({
      from: vi.fn(() => settingsQuery),
    })

    await expect(getSettings()).resolves.toMatchObject({
      storewideDiscountPercent: 0,
      discountStartDate: undefined,
      discountEndDate: undefined,
    })
    expect(settingsQuery.single).toHaveBeenCalledTimes(2)
  })
})
