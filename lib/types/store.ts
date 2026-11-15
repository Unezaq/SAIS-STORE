export interface StoreOrder {
  id: string
  clientEmail?: string
  clientName?: string
  customerName: string
  phone: string
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
  deliveryFee: number
  total: number
  status: 'en_attente' | 'confirmee' | 'expediee' | 'livree' | 'annulee'
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
