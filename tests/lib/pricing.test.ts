import { describe, it, expect } from 'vitest'
import { getStorePrice, applyStorePrice } from '@/lib/pricing'
import type { Product } from '@/lib/data'
import type { StoreSettings } from '@/lib/types/store'

const baseProduct: Product = {
  id: 'prod-1',
  slug: 'ensemble-hiver',
  title: 'Ensemble Hiver',
  price: 500,
  imageUrl: '/products/sais-01.jpg',
  categoryName: 'Ensembles',
  slugCategory: 'ensembles',
}

const baseSettings: StoreSettings = {
  storeName: 'SAIS Store',
  whatsappPhone: '212644816544',
  deliveryText: 'Livraison 24-48h',
  paymentText: 'Paiement à la livraison',
  currency: 'MAD',
  deliveryFee: 22,
  freeDeliveryMinItems: 3,
  storewideDiscountPercent: 0,
}

describe('Pricing calculations', () => {
  it('returns base price when no discounts are active', () => {
    const price = getStorePrice(baseProduct, baseSettings)
    expect(price).toBe(500)
  })

  it('preserves existing product promo price and excludes it from storewide promo', () => {
    const discountedProduct: Product = {
      ...baseProduct,
      price: 400,
      originalPrice: 500,
    }
    const promoSettings: StoreSettings = {
      ...baseSettings,
      storewideDiscountPercent: 20,
      discountStartDate: '2026-01-01',
      discountEndDate: '2026-12-31',
    }

    const price = getStorePrice(discountedProduct, promoSettings, new Date('2026-06-15T12:00:00Z'))
    expect(price).toBe(400) // Does not double discount
  })

  it('applies storewide promotion when active', () => {
    const promoSettings: StoreSettings = {
      ...baseSettings,
      storewideDiscountPercent: 20, // 20% off 500 = 400
      discountStartDate: '2026-06-01',
      discountEndDate: '2026-06-30',
    }

    const activePrice = getStorePrice(baseProduct, promoSettings, new Date('2026-06-15T12:00:00Z'))
    expect(activePrice).toBe(400)

    const expiredPrice = getStorePrice(baseProduct, promoSettings, new Date('2026-07-01T12:00:00Z'))
    expect(expiredPrice).toBe(500)
  })

  it('applyStorePrice transforms product with originalPrice', () => {
    const promoSettings: StoreSettings = {
      ...baseSettings,
      storewideDiscountPercent: 10,
      discountStartDate: '2026-01-01',
      discountEndDate: '2026-12-31',
    }
    const transformed = applyStorePrice(baseProduct, promoSettings, new Date('2026-06-01T12:00:00Z'))
    expect(transformed.price).toBe(450)
    expect(transformed.originalPrice).toBe(500)
  })
})
