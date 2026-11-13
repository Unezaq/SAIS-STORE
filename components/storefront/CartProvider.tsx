'use client'

import * as React from 'react'
import { z } from 'zod'

const STORAGE_KEY = 'sais-store-cart'

const cartItemSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  imageUrl: z.string().min(1),
  price: z.number().finite().nonnegative(),
  quantity: z.number().int().min(1).max(99),
  size: z.string().optional(),
  color: z.string().optional(),
})

const storedCartSchema = z.array(cartItemSchema)

export type CartItem = z.infer<typeof cartItemSchema>

interface CartContextValue {
  items: CartItem[]
  count: number
  subtotal: number
  ready: boolean
  addItem: (item: CartItem) => void
  updateQuantity: (key: string, quantity: number) => void
  removeItem: (key: string) => void
  clearCart: () => void
}

const CartContext = React.createContext<CartContextValue | null>(null)

export function getCartItemKey(item: Pick<CartItem, 'slug' | 'size' | 'color'>): string {
  return `${item.slug}::${item.size ?? ''}::${item.color ?? ''}`
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CartItem[]>([])
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = storedCartSchema.safeParse(JSON.parse(stored))
        if (parsed.success) setItems(parsed.data)
        else window.localStorage.removeItem(STORAGE_KEY)
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error
        window.localStorage.removeItem(STORAGE_KEY)
      }
    }
    setReady(true)
  }, [])

  React.useEffect(() => {
    if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items, ready])

  const addItem = React.useCallback((item: CartItem) => {
    setItems((current) => {
      const key = getCartItemKey(item)
      const existing = current.find((candidate) => getCartItemKey(candidate) === key)
      if (!existing) return [...current, { ...item, quantity: Math.min(item.quantity, 99) }]

      return current.map((candidate) =>
        getCartItemKey(candidate) === key
          ? { ...candidate, quantity: Math.min(candidate.quantity + item.quantity, 99) }
          : candidate
      )
    })
  }, [])

  const updateQuantity = React.useCallback((key: string, quantity: number) => {
    setItems((current) =>
      current.map((item) =>
        getCartItemKey(item) === key
          ? { ...item, quantity: Math.max(1, Math.min(Math.trunc(quantity), 99)) }
          : item
      )
    )
  }, [])

  const removeItem = React.useCallback((key: string) => {
    setItems((current) => current.filter((item) => getCartItemKey(item) !== key))
  }, [])

  const clearCart = React.useCallback(() => setItems([]), [])
  const count = React.useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items]
  )
  const subtotal = React.useMemo(
    () => items.reduce((total, item) => total + item.price * item.quantity, 0),
    [items]
  )

  const value = React.useMemo(
    () => ({ items, count, subtotal, ready, addItem, updateQuantity, removeItem, clearCart }),
    [items, count, subtotal, ready, addItem, updateQuantity, removeItem, clearCart]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const value = React.useContext(CartContext)
  if (!value) throw new Error('useCart must be used within a CartProvider.')
  return value
}
