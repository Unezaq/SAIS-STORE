/**
 * lib/products.ts — Point d'entrée unique pour les données.
 * Toutes les fonctions délèguent à lib/store.ts (Supabase).
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
  getOrdersByClientEmail,
  updateOrderStatus,
  getAllClients as getClients,
  createOrder,
  getSettings,
  updateSettings,
  // Client accounts
  createClientAccount,
  getClientByEmail,
  verifyClientCredentials,
  // Admin accounts
  verifyAdminCredentials,
  setAdminPassword,
} from './store'

// Password helpers live in lib/utils/crypto.ts
export { hashPassword, verifyPassword } from '@/lib/utils/crypto'

import type { Product } from './data'
import type {
  StoreOrder,
  StoreClient,
  StoreSettings,
  StoreClientAccount,
  AdminAccount,
} from './types/store'

export type {
  Product,
  StoreOrder,
  StoreClient,
  StoreSettings,
  StoreClientAccount,
  AdminAccount,
}

export { discountPercent } from './data'
