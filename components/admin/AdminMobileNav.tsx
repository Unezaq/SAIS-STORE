'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import {
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Activity,
  Tag,
  Settings,
} from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { logoutAction } from '@/actions/admin'
import { cn } from '@/lib/utils'

const nav = [
  { label: 'Tableau de bord', href: '/admin', icon: LayoutDashboard },
  { label: 'Produits', href: '/admin/products', icon: Package },
  { label: 'Commandes', href: '/admin/orders', icon: ShoppingCart },
  { label: 'Pilotage', href: '/admin/pilotage', icon: Activity },
  { label: 'Clientes', href: '/admin/clients', icon: Users },
  { label: 'Promotions', href: '/admin/coupons', icon: Tag },
  { label: 'Paramètres', href: '/admin/settings', icon: Settings },
]

/**
 * Mobile admin navigation: a hamburger button (renders in place) that opens a
 * slide-in side drawer with all admin links + logout. Active page is highlighted.
 * Desktop keeps the fixed sidebar, so this is md:hidden everywhere.
 */
export default function AdminMobileNav() {
  const [open, setOpen] = React.useState(false)
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()

  // Close drawer on route change
  React.useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Prevent body scroll when drawer is open
  React.useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Swipe to close
  const touchStartX = React.useRef<number | null>(null)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const diff = e.changedTouches[0].clientX - touchStartX.current
    if (diff < -60) setOpen(false)
    touchStartX.current = null
  }

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  return (
    <>
      {/* Hamburger toggle */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press p-2 text-ink hover:text-ink md:hidden"
        aria-label="Ouvrir le menu"
      >
        <Menu size={20} />
      </button>

      {/* Drawer + backdrop */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0.1 : 0.2 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            />

            {/* Slide-in drawer panel */}
            <motion.aside
              initial={reduceMotion ? { opacity: 0 } : { x: '-100%' }}
              animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { x: '-100%' }}
              transition={
                reduceMotion
                  ? { duration: 0.1 }
                  : { type: 'spring', bounce: 0.1, duration: 0.3 }
              }
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="fixed inset-y-0 left-0 z-50 w-full max-w-xs flex flex-col bg-white border-r border-hairline md:hidden"
            >
              <div className="flex h-16 items-center justify-between border-b border-hairline px-4">
                <span className="text-[15px] font-semibold uppercase tracking-[0.2em]">SAIS Admin</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="press p-2 text-ink hover:text-ink"
                  aria-label="Fermer le menu"
                >
                  <X size={20} />
                </button>
              </div>
              <nav className="flex-1 px-3 py-4 overflow-y-auto">
                <ul className="flex flex-col gap-1">
                  {nav.map((item) => {
                    const Icon = item.icon
                    const active = isActive(item.href)
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors',
                            active
                              ? 'bg-primary/10 text-primary'
                              : 'text-text-muted hover:bg-surface-soft hover:text-ink'
                          )}
                        >
                          <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                          {item.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </nav>
              <form action={logoutAction} className="border-t border-hairline p-4">
                <LogoutSubmitButton />
              </form>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

function LogoutSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-soft hover:text-ink disabled:opacity-50"
    >
      {pending ? (
        <span
          aria-hidden="true"
          className="h-[17px] w-[17px] animate-spin rounded-full border-2 border-current/30 border-t-current"
        />
      ) : (
        <LogOut size={17} strokeWidth={1.8} />
      )}
      {pending ? 'Déconnexion…' : 'Déconnexion'}
    </button>
  )
}
