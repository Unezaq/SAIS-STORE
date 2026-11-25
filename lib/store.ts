/**
 * lib/store.ts — Domain Facade.
 * Clean, backward-compatible entry point delegating to modular domain services:
 * - lib/services/products.service.ts
 * - lib/services/orders.service.ts
 * - lib/services/clients.service.ts
 * - lib/services/coupons.service.ts
 * - lib/services/settings.service.ts
 */

import 'server-only'

// Products
export {
  getProducts,
  getProduct,
  getProductsByCategory,
  getPromoProducts,
  upsertProduct,
  deleteProduct,
} from '@/lib/services/products.service'

// Orders
export {
  createOrder,
  getOrders,
  getOrderById,
  getOrderByToken,
  getOrderDetail,
  getOrderForTracking,
  getOrdersByPhone,
  getOrdersByUserId,
  updateOrderStatus,
  cancelOrder,
  returnOrder,
} from '@/lib/services/orders.service'

// Clients / CRM
export {
  getClients,
  getAdminClients,
  getClientByPhone,
} from '@/lib/services/clients.service'
export type { AdminClientEntry } from '@/lib/services/clients.service'

// Coupons
export {
  getCoupons,
  upsertCoupon,
  deleteCoupon,
  toggleCoupon,
  validateCoupon,
} from '@/lib/services/coupons.service'

// Settings
export {
  getSettings,
  updateSettings,
} from '@/lib/services/settings.service'

// Cache Invalidation
export function invalidateStoreCache(): void {
  // Next.js App Router cache revalidation is handled per path via revalidatePath()
}
