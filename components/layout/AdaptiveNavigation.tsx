'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Minus, Plus, Search, ShoppingBag, Trash2 } from 'lucide-react'
import { BottomTabBar } from './BottomTabBar'
import { TopNav } from './TopNav'
import { getCartItemKey, useCart } from '@/components/storefront/CartProvider'
import { EmptyState } from '@/components/ui/EmptyState'
import { Sheet } from '@/components/ui/Sheet'
import { formatMAD } from '@/lib/utils'
import { useWishlist } from '@/hooks/useWishlist'
import type { StoreSettings } from '@/lib/types/store'

export function AdaptiveNavigation({
  settings,
  isAdmin = false,
}: {
  settings: StoreSettings
  isAdmin?: boolean
}) {
  const [cartOpen, setCartOpen] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const { items, count, subtotal, ready, updateQuantity, removeItem } = useCart()
  const { count: wishlistCount } = useWishlist()
  const deliveryFee =
    settings.freeDeliveryMinItems > 0 && count >= settings.freeDeliveryMinItems
      ? 0
      : settings.deliveryFee

  return (
    <>
      <TopNav
        cartCount={count}
        wishlistCount={wishlistCount}
        whatsappPhone={settings.whatsappPhone}
        isAdmin={isAdmin}
        onOpenCart={() => setCartOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
      />

      <BottomTabBar
        cartCount={count}
        onOpenCart={() => setCartOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
      />

      <Sheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title={`Votre panier${count ? ` (${count})` : ''}`}
        description="Paiement à la livraison partout au Maroc"
      >
        {!ready ? (
          <p className="py-8 text-center text-sm text-text-muted">Chargement du panier…</p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag size={24} />}
            title="Votre panier est vide"
            description="Découvrez nos collections et ajoutez vos pièces préférées."
            action={
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="press inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-primary-light"
              >
                Continuer mes achats
              </button>
            }
          />
        ) : (
          <div className="flex flex-col gap-5">
            <ul className="flex flex-col divide-y divide-hairline">
              {items.map((item) => {
                const key = getCartItemKey(item)
                return (
                  <li key={key} className="flex gap-3 py-4">
                    <Link
                      href={`/products/${item.slug}`}
                      onClick={() => setCartOpen(false)}
                      className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-soft"
                    >
                      <Image src={item.imageUrl} alt={item.title} fill sizes="64px" className="object-cover" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/products/${item.slug}`}
                        onClick={() => setCartOpen(false)}
                        className="line-clamp-2 text-sm font-medium text-ink"
                      >
                        {item.title}
                      </Link>
                      <p className="mt-1 text-xs text-text-muted">
                        {[item.color, item.size].filter(Boolean).join(' · ') || 'Taille/couleur au choix'}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-ink">{formatMAD(item.price)}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center rounded-full border border-hairline">
                          <button
                            type="button"
                            onClick={() => updateQuantity(key, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            aria-label={`Diminuer la quantité de ${item.title}`}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-ink disabled:opacity-40"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="min-w-7 text-center text-xs tabular">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(key, item.quantity + 1)}
                            disabled={item.quantity >= 99}
                            aria-label={`Augmenter la quantité de ${item.title}`}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-ink disabled:opacity-40"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(key)}
                          aria-label={`Retirer ${item.title} du panier`}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            {settings.freeDeliveryMinItems > 0 && count < settings.freeDeliveryMinItems && (
              <div className="rounded-2xl bg-primary/5 p-3 ring-1 ring-primary/10">
                <p className="text-xs font-medium text-primary">
                  Plus que {settings.freeDeliveryMinItems - count} pièce{settings.freeDeliveryMinItems - count > 1 ? 's' : ''} pour la livraison gratuite !
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (count / settings.freeDeliveryMinItems) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-hairline pt-4">
              <span className="text-sm text-text-muted">Sous-total</span>
              <span className="text-base font-semibold text-ink">{formatMAD(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Livraison</span>
              <span className="font-medium text-ink">
                {deliveryFee === 0 ? 'Gratuite' : formatMAD(deliveryFee)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-hairline pt-3">
              <span className="text-sm font-semibold text-ink">Total estimé</span>
              <span className="text-base font-semibold text-ink">
                {formatMAD(subtotal + deliveryFee)}
              </span>
            </div>
            {deliveryFee === 0 && settings.freeDeliveryMinItems > 0 && (
              <p className="-mt-2 text-xs text-primary">
                Livraison offerte dès {settings.freeDeliveryMinItems} pièces.
              </p>
            )}
            <p className="-mt-2 text-xs leading-relaxed text-text-muted">
              Paiement en espèces à la livraison. Les prix des produits sont revérifiés lors de la validation.
            </p>
            <Link
              href="/checkout"
              onClick={() => setCartOpen(false)}
              className="press inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-white hover:bg-primary-light"
            >
              Finaliser ma commande
            </Link>
          </div>
        )}
      </Sheet>

      <Sheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Rechercher un produit"
        description="Cherchez par nom, coloris ou collection."
      >
        <form action="/boutique" method="get" onSubmit={() => setSearchOpen(false)} className="flex gap-2 py-2">
          <label htmlFor="store-search" className="sr-only">Rechercher un produit</label>
          <input
            id="store-search"
            type="search"
            name="q"
            placeholder="Ex. peignoir bleu…"
            className="min-w-0 flex-1 rounded-full border border-ink/10 bg-surface-soft px-5 py-3 text-sm text-ink placeholder:text-text-muted/60 focus:border-ink/30 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Lancer la recherche"
            className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-light"
          >
            <Search size={17} />
          </button>
        </form>
      </Sheet>
    </>
  )
}
