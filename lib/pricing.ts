import type { Product } from './data'
import type { StoreSettings } from './types/store'

function moroccoDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Casablanca',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  if (!year || !month || !day) throw new Error('Could not determine the current Morocco date.')
  return `${year}-${month}-${day}`
}

export function getStorePrice(
  product: Product,
  settings: StoreSettings,
  now = new Date()
): number {
  const hasProductDiscount =
    product.originalPrice !== undefined && product.originalPrice > product.price
  const today = moroccoDate(now)
  const storeDiscountIsActive =
    settings.storewideDiscountPercent > 0 &&
    Boolean(settings.discountStartDate && settings.discountEndDate) &&
    today >= (settings.discountStartDate ?? '') &&
    today <= (settings.discountEndDate ?? '')

  if (hasProductDiscount || !storeDiscountIsActive) return product.price

  return Math.max(
    1,
    Math.round(product.price * (100 - settings.storewideDiscountPercent) / 100)
  )
}

export function applyStorePrice(product: Product, settings: StoreSettings): Product {
  const price = getStorePrice(product, settings)
  return price < product.price
    ? { ...product, originalPrice: product.price, price }
    : product
}
