/**
 * lib/coupons.ts — Re-export facade delegating to lib/services/coupons.service.ts
 */

export {
  getCoupons,
  upsertCoupon,
  deleteCoupon,
  toggleCoupon,
  validateCoupon,
} from '@/lib/services/coupons.service'
