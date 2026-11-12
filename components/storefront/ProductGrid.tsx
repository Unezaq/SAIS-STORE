'use client'

import { motion, useReducedMotion } from 'motion/react'
import { ProductCard } from './ProductCard'
import { useWishlist } from '@/hooks/useWishlist'

export interface ProductGridProps {
  products: Array<{
    id: string
    title: string
    slug: string
    price: number
    originalPrice?: number
    imageUrl: string
    videoUrl?: string
    categoryName?: string
    badge?: string
  }>
  emptyMessage?: string
  className?: string
}

export function ProductGrid({
  products,
  emptyMessage = 'Aucune pièce dans cette collection pour le moment.',
  className,
}: ProductGridProps) {
  const reduceMotion = useReducedMotion()
  const { isLiked, toggle } = useWishlist()

  if (products.length === 0) {
    return (
      <div className={className}>
        <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-text-muted">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {products.map((p, index) => (
        <motion.div
          key={p.id}
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
          whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={
            reduceMotion
              ? { duration: 0.2 }
              : {
                  type: 'spring',
                  bounce: 0,
                  duration: 0.6,
                  // Small per-card offset keeps the cascade feel without a
                  // shared parent variant (which could strand cards hidden).
                  delay: (index % 4) * 0.05,
                }
          }
          className="min-w-0"
        >
          <ProductCard {...p} isLiked={isLiked(p.id)} onToggleLike={toggle} />
        </motion.div>
      ))}
    </div>
  )
}
