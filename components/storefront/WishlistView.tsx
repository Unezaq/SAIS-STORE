'use client'

import Link from 'next/link'
import { Heart } from 'lucide-react'
import { ProductGrid } from '@/components/storefront/ProductGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { useWishlist } from '@/hooks/useWishlist'
import type { Product } from '@/lib/data'

export function WishlistView({ products }: { products: Product[] }) {
  const { ids, ready } = useWishlist()
  const liked = products.filter((p) => ids.includes(p.id))

  return (
    <div className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-4 md:px-fib-4 md:pt-fib-5">
      <div className="mb-fib-4 max-w-2xl md:mb-fib-5">
        <p className="text-eyebrow uppercase text-text-muted">Favoris</p>
        <h1 className="mt-fib-1 text-title text-ink">Vos favoris</h1>
        <p className="mt-fib-2 text-sm leading-relaxed text-text-muted md:text-[15px]">
          Les pièces que vous gardez de côté restent enregistrées sur cet appareil — aucun compte
          n&apos;est nécessaire.
        </p>
      </div>

      {!ready ? (
        <div className="grid grid-cols-2 gap-x-3.5 gap-y-8 md:grid-cols-4 md:gap-x-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="aspect-[3/4] w-full animate-pulse rounded-[20px] bg-surface-soft"
            />
          ))}
        </div>
      ) : liked.length === 0 ? (
        <EmptyState
          icon={<Heart size={22} />}
          title="Aucun favori pour l’instant"
          description="Touchez le cœur sur une pièce pour la retrouver ici."
          action={
            <Link href="/collections">
              <Button variant="primary" size="md">
                Parcourir le catalogue
              </Button>
            </Link>
          }
        />
      ) : (
        <ScrollReveal variant="fade-up" delay={0.05}>
          <ProductGrid
            products={liked}
            className="grid grid-cols-2 gap-x-fib-2 gap-y-fib-4 md:grid-cols-4 md:gap-x-fib-3"
          />
        </ScrollReveal>
      )}
    </div>
  )
}
