import type { OrderStatus } from '@/lib/orderStatus'

export interface StoreOrder {
  id: string
  orderNumber?: string
  trackingToken?: string
  clientEmail?: string
  clientName?: string
  customerName: string
  phone: string
  city: string
  address: string
  items: Array<{
    slug: string
    title: string
    color?: string
    size?: string
    quantity: number
    price: number
  }>
  subtotal: number
  discountTotal: number
  deliveryFee: number
  total: number
  couponCode?: string
  paymentMethod: string
  paymentStatus: string
  status: OrderStatus
  createdAt: string
  note?: string
}

export interface StoreClient {
  id: string
  email: string | null
  firstName: string
  lastName: string
  phone: string
  address?: string
  orderCount: number
  totalSpent: number
  createdAt: string
}

export type ViewerRole = 'admin' | 'customer' | 'guest'

export interface StoreViewer {
  role: ViewerRole
  isAdmin: boolean
  isSignedIn: boolean
  firstName: string | null
}

export interface StoreSettings {
  storeName: string
  whatsappPhone: string
  deliveryText: string
  paymentText: string
  currency: string
  deliveryFee: number
  freeDeliveryMinItems: number
  storewideDiscountPercent: number
  discountStartDate?: string
  discountEndDate?: string
}

export interface StoreCoupon {
  id: string
  code: string
  type: 'percentage' | 'fixed'
  value: number
  minOrder: number
  startsAt: string
  expiresAt?: string
  maxUses?: number
  usedCount: number
  perUserLimit?: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface StoreProductVariant {
  id: string
  productId: string
  size?: string
  color?: string
  stock: number
  priceAdjustment: number
  sku?: string
}

export interface CouponValidationResult {
  valid: boolean
  discountAmount: number
  message: string
}
