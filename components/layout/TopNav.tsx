'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingBag, Search, User, Heart } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { categories } from '@/lib/data'
import { cn } from '@/lib/utils'

export interface TopNavProps {
  cartCount?: number
  wishlistCount?: number
  whatsappPhone: string
  isAdmin?: boolean
  onOpenCart?: () => void
  onOpenSearch?: () => void
}

/**
 * Store-style header, two rows like LC Waikiki / Decathlon:
 * 1. utility strip — delivery promise, order tracking, contact;
 * 2. main row — brand, family links with hover previews, account actions.
 */
export function TopNav({
  cartCount = 0,
  wishlistCount = 0,
  whatsappPhone,
  isAdmin = false,
  onOpenCart,
  onOpenSearch,
}: TopNavProps) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = React.useState(false)

  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { label: 'Accueil', href: '/' },
    { label: 'Boutique', href: '/boutique', mega: true },
  ]
  const megaFamilies = categories.filter((c) => c.slug !== 'all')
  const megaLinks = [
    { label: 'Nouveautés', href: '/collections/nouveautes' },
    { label: 'Promotions', href: '/promotions' },
    { label: 'Espace client', href: '/espace-client' },
  ]

  return (
    <header
      className={cn(
        'material sticky top-0 z-40 hidden w-full md:block',
        'transition-shadow duration-300',
        scrolled && 'shadow-[inset_0_-1px_0_var(--color-hairline)]'
      )}
    >
      {/* Utility strip */}
      <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-6 text-[11px] tracking-[0.01em] text-text-muted lg:px-8">
        <p>Livraison 24–48h partout au Maroc · Paiement à la livraison</p>
        <div className="flex items-center gap-5">
          <Link href="/promotions" className="transition-colors hover:text-ink">
            Promotions
          </Link>
          <Link href="/espace-client" className="transition-colors hover:text-ink">
            Espace client
          </Link>
          <Link href="/compte" className="transition-colors hover:text-ink">
            Mon compte
          </Link>
          {isAdmin && (
            <Link href="/admin" className="font-medium text-primary transition-colors hover:text-ink">
              Admin
            </Link>
          )}
          <a
            href={`https://wa.me/${whatsappPhone}`}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-ink"
          >
            Nous écrire
          </a>
        </div>
      </div>

      <div className="h-px w-full bg-hairline/70" />

      {/* Main row */}
      <div className="mx-auto flex h-[60px] max-w-7xl items-center justify-between px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="text-[17px] font-semibold uppercase leading-none tracking-[0.2em] text-ink">
            SAIS
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-text-muted/70">
            Store
          </span>
        </Link>

        {/* Links */}
        <nav className="flex h-full items-stretch gap-7">
          {navLinks.map((link) => {
            const active =
              link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)

            return (
              <div key={link.href} className="group relative flex items-stretch">
                <Link
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  aria-haspopup={link.mega ? 'true' : undefined}
                  className={cn(
                    'relative flex items-center py-1 text-[13px] tracking-[-0.01em] transition-colors duration-200',
                    'after:absolute after:inset-x-0 after:bottom-2 after:h-[1.5px] after:origin-center after:scale-x-0 after:rounded-full after:bg-ink after:transition-transform after:duration-300',
                    active
                      ? 'text-ink after:scale-x-100'
                      : 'text-text-muted hover:text-ink'
                  )}
                >
                  {link.label}
                </Link>

                {/* Mega menu — every family lives inside the Boutique link */}
                {link.mega && (
                  <div className="invisible absolute start-1/2 top-full z-50 -translate-x-1/2 pt-2 opacity-0 transition-opacity duration-200 group-hover:visible group-hover:opacity-100">
                    <div className="grid w-[560px] grid-cols-3 gap-2 overflow-hidden rounded-2xl bg-surface p-3 text-start shadow-[0_16px_40px_-12px_rgba(16,32,26,0.25)] ring-1 ring-hairline">
                      {megaFamilies.map((family) => (
                        <Link
                          key={family.slug}
                          href={`/collections/${family.slug}`}
                          className="group/item block overflow-hidden rounded-xl bg-surface-soft"
                        >
                          <div className="relative aspect-[4/3] w-full overflow-hidden">
                            <Image
                              src={family.imageUrl}
                              alt={family.name}
                              fill
                              sizes="170px"
                              className="object-cover object-center transition-transform duration-500 group-hover/item:scale-[1.05]"
                            />
                          </div>
                          <div className="p-fib-2">
                            <p className="text-[13px] font-semibold text-ink">{family.name}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-4 rounded-2xl bg-surface px-4 py-3 shadow-[0_16px_40px_-12px_rgba(16,32,26,0.25)] ring-1 ring-hairline">
                      {megaLinks.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="text-[12px] font-medium text-text-muted transition-colors hover:text-ink"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenSearch}
            className="press flex h-9 w-9 items-center justify-center rounded-full text-ink/70 hover:bg-ink/[0.05] hover:text-ink"
            aria-label="Rechercher"
          >
            <Search size={17} strokeWidth={1.8} />
          </button>

          <Link
            href="/compte"
            className="press flex h-9 w-9 items-center justify-center rounded-full text-ink/70 hover:bg-ink/[0.05] hover:text-ink"
            aria-label="Mon compte"
          >
            <User size={17} strokeWidth={1.8} />
          </Link>

          <Link
            href="/wishlist"
            className="press relative flex h-9 w-9 items-center justify-center rounded-full text-ink/70 hover:bg-ink/[0.05] hover:text-ink"
            aria-label="Favoris"
          >
            <Heart size={17} strokeWidth={1.8} />
            {wishlistCount > 0 && (
              <span className="tabular absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
                {wishlistCount}
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={onOpenCart}
            className="press relative ms-1 flex h-9 items-center gap-2 rounded-full bg-ink/[0.06] px-3 text-ink hover:bg-ink/[0.1]"
            aria-label="Panier d'achats"
          >
            <ShoppingBag size={16} strokeWidth={1.9} />
            <AnimatePresence mode="popLayout">
              <motion.span
                key={cartCount}
                className="tabular text-xs font-semibold"
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: 'spring', bounce: 0.4, duration: 0.3 }}
              >
                {cartCount}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>
    </header>
  )
}
