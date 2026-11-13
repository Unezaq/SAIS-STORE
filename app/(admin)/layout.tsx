import Link from 'next/link'
import { LayoutDashboard, Package, ShoppingCart, Users, Settings } from 'lucide-react'
import { LogoutButton } from '@/components/admin/LogoutButton'
import { requireAdmin } from '@/lib/supabase/auth'

const nav = [
  { label: 'Tableau de bord', href: '/admin', icon: LayoutDashboard },
  { label: 'Produits', href: '/admin/products', icon: Package },
  { label: 'Commandes', href: '/admin/orders', icon: ShoppingCart },
  { label: 'Clients', href: '/admin/clients', icon: Users },
  { label: 'Paramètres', href: '/admin/settings', icon: Settings },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  return (
    <div className="flex min-h-dvh bg-surface-soft text-ink">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-hairline bg-white md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-hairline px-6">
          <span className="text-[15px] font-semibold uppercase tracking-[0.2em]">SAIS</span>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-text-muted">Admin</span>
        </div>
        <nav className="flex-1 px-3 py-4">
          <ul className="flex flex-col gap-1">
            {nav.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-soft hover:text-ink"
                  >
                    <Icon size={17} strokeWidth={1.8} />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <LogoutButton />
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-hairline bg-white px-6 md:hidden">
          <span className="text-[15px] font-semibold uppercase tracking-[0.2em]">SAIS Admin</span>
        </header>
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  )
}
