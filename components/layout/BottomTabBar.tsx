'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Grid, Search, ShoppingBag, User } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

export interface BottomTabBarProps {
  cartCount?: number
  onOpenCart?: () => void
  onOpenSearch?: () => void
}

/**
 * Mobile chrome: same translucent material as the desktop bar, with the
 * indicator moving on a critically damped spring so it settles instead of
 * overshooting.
 */
export function BottomTabBar({ cartCount = 0, onOpenCart, onOpenSearch }: BottomTabBarProps) {
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()

  const tabs = [
    { id: 'home', label: 'Accueil', href: '/', icon: Home },
    { id: 'boutique', label: 'Boutique', href: '/boutique', icon: Grid },
    { id: 'search', label: 'Recherche', href: '#search', icon: Search, isAction: true },
    { id: 'cart', label: 'Panier', href: '#cart', icon: ShoppingBag, isAction: true, badge: cartCount },
    { id: 'account', label: 'Compte', href: '/account', icon: User },
  ]

  return (
    <nav
      className="material fixed inset-x-0 bottom-0 z-40 select-none shadow-[inset_0_1px_0_var(--color-hairline)] md:hidden"
      style={{
        height: 'calc(62px + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="mx-auto flex h-[62px] max-w-lg items-center justify-around px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = !tab.isAction && pathname === tab.href

          if (tab.isAction) {
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (tab.id === 'cart') onOpenCart?.()
                  if (tab.id === 'search') onOpenSearch?.()
                }}
                className="press relative flex min-h-[48px] min-w-[56px] flex-col items-center justify-center gap-1 text-text-muted hover:text-ink"
                aria-label={tab.label}
              >
                <div className="relative">
                  <Icon size={20} strokeWidth={1.7} />
                  {typeof tab.badge === 'number' && tab.badge > 0 && (
                    <span className="tabular absolute -end-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium tracking-[-0.01em]">{tab.label}</span>
              </button>
            )
          }

          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'press relative flex min-h-[48px] min-w-[56px] flex-col items-center justify-center gap-1',
                isActive ? 'text-ink' : 'text-text-muted hover:text-ink'
              )}
            >
              <div className="relative flex flex-col items-center">
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.7} />
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute -bottom-1.5 h-1 w-1 rounded-full bg-primary"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: 'spring', bounce: 0, duration: 0.3 }
                    }
                  />
                )}
              </div>
              <span className={cn('text-[10px] tracking-[-0.01em]', isActive && 'font-semibold')}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
