'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Package, ShoppingCart, Users } from 'lucide-react'

const tabs = [
  { id: 'dashboard', label: 'Tableau de bord', href: '/admin', icon: LayoutDashboard },
  { id: 'products', label: 'Produits', href: '/admin/products', icon: Package },
  { id: 'orders', label: 'Commandes', href: '/admin/orders', icon: ShoppingCart },
  { id: 'clients', label: 'Clientes', href: '/admin/clients', icon: Users },
]

/**
 * Mobile admin bottom tab bar: 4 icon-only tabs (Dashboard, Products, Orders,
 * Clients) pinned to the bottom of the screen. Follows the same pattern as the
 * storefront BottomTabBar but for the admin sections.
 */
export function AdminBottomTabBar() {
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

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
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              aria-label={tab.label}
              className={cn(
                'press relative flex min-h-[48px] min-w-[56px] flex-col items-center justify-center gap-1',
                active ? 'text-ink' : 'text-text-muted hover:text-ink'
              )}
            >
              <div className="relative flex flex-col items-center">
                <Icon size={20} strokeWidth={active ? 2.2 : 1.7} />
                {active && (
                  <motion.div
                    layoutId="adminActiveTabIndicator"
                    className="absolute -bottom-1.5 h-1 w-1 rounded-full bg-primary"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: 'spring', bounce: 0, duration: 0.3 }
                    }
                  />
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
