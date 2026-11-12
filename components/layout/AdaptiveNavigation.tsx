'use client'

import * as React from 'react'
import { TopNav } from './TopNav'
import { BottomTabBar } from './BottomTabBar'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ShoppingBag } from 'lucide-react'
import { useWishlist } from '@/hooks/useWishlist'

export function AdaptiveNavigation() {
  const [cartOpen, setCartOpen] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [cartItemsCount] = React.useState(2) // Sample initial count for demo
  const { count: wishlistCount } = useWishlist()

  return (
    <>
      <TopNav
        cartCount={cartItemsCount}
        wishlistCount={wishlistCount}
        onOpenCart={() => setCartOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
      />

      <BottomTabBar
        cartCount={cartItemsCount}
        onOpenCart={() => setCartOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {/* Shared Cart Drawer (Slide-Over on desktop, Bottom Sheet on mobile) */}
      <Sheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title="Votre Panier"
        description="Paiement en espèces à la livraison (COD)"
      >
        <div className="flex flex-col gap-4">
          <EmptyState
            icon={<ShoppingBag size={24} />}
            title="Votre panier SAIS"
            description="Découvrez nos dernières collections pour ajouter vos pièces préférées."
            action={
              <Button onClick={() => setCartOpen(false)} variant="primary" size="md">
                Continuer mes achats
              </Button>
            }
          />
        </div>
      </Sheet>

      {/* Quick Search Sheet */}
      <Sheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Rechercher"
        description="Trouvez une robe, une abaya ou un ensemble"
      >
        <div className="py-2">
          <input
            type="search"
            placeholder="Rechercher par nom, couleur ou collection..."
            className="w-full rounded-full border border-ink/10 bg-surface-soft px-5 py-3 text-sm text-ink placeholder:text-text-muted/60 focus:border-ink/30 focus:outline-none"
            autoFocus
          />
        </div>
      </Sheet>
    </>
  )
}

