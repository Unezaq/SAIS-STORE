/**
 * lib/products.ts — Point d'entrée unique pour les données.
 * Toutes les fonctions délèguent à lib/store.ts, lib/coupons.ts et lib/addresses.ts.
 */

export {
  invalidateStoreCache,
  getProducts,
  getProduct,
  getProductsByCategory,
  getPromoProducts,
  upsertProduct,
  deleteProduct,
  getOrders,
  getOrdersByAuthUserId,
  updateOrderStatus,
  getOrderByToken,
  getOrderDetail,
  getClients,
  getAdminClients,
  getClientByAuthUserId,
  ensureClientProfile,
  createOrder,
  getSettings,
  updateSettings,
} from './store'

export {
  getCoupons,
  upsertCoupon,
  deleteCoupon,
  toggleCoupon,
  validateCoupon,
} from './coupons'

export {
  getAddresses,
  upsertAddress,
  deleteAddress,
  getDefaultAddress,
  getAdminAddresses,
} from './addresses'

import {
  getProduct,
  getProducts,
  getProductsByCategory,
  getPromoProducts,
  getSettings,
} from './store'
import { applyStorePrice } from './pricing'
import type { Product } from './data'
import type {
  StoreOrder,
  StoreClient,
  StoreSettings,
} from './types/store'

export type {
  StoreOrder,
  StoreClient,
  StoreSettings,
  StoreCoupon,
  StoreAddress,
  StoreProductVariant,
  CouponValidationResult,
} from './types/store'

export type { Product } from './data'

export { discountPercent } from './data'

export async function getStorefrontProducts(): Promise<Product[]> {
  const [products, settings] = await Promise.all([getProducts(), getSettings()])
  return products.map((product) => applyStorePrice(product, settings))
}

export async function getStorefrontProduct(slug: string): Promise<Product | undefined> {
  const [product, settings] = await Promise.all([getProduct(slug), getSettings()])
  return product ? applyStorePrice(product, settings) : undefined
}

export async function getStorefrontProductsByCategory(slug: string): Promise<Product[]> {
  const [products, settings] = await Promise.all([
    slug === 'all' || slug === 'nouveautes'
      ? getProducts()
      : getProductsByCategory(slug),
    getSettings(),
  ])
  const visible = slug === 'nouveautes'
    ? products.filter((product) => product.badge === 'Nouveau')
    : products
  return visible.map((product) => applyStorePrice(product, settings))
}

export async function getStorefrontPromoProducts(): Promise<Product[]> {
  const [products, settings] = await Promise.all([getProducts(), getSettings()])
  return products
    .map((product) => applyStorePrice(product, settings))
    .filter((product) => Boolean(product.originalPrice && product.originalPrice > product.price))
}
