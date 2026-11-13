'use client'

import * as React from 'react'
import { ProductGrid } from './ProductGrid'
import type { Product } from '@/lib/data'

export interface ProductShopProps {
  products: Product[]
  emptyMessage?: string
}
import { cn } from '@/lib/utils'

/**
 * Tabs mirror the store families; "Tout" replaces the old "Accueil" link so
 * the whole catalogue is reachable without leaving the home page.
 */
const TABS = [
  { id: 'all', label: 'Tout' },
  { id: 'peignoirs', label: 'Peignoirs' },
  { id: 'pyjamas', label: 'Pyjamas Polaires' },
  { id: 'ensembles', label: 'Ensembles Hiver' },
  { id: 'nouveautes', label: 'Nouveautés' },
] as const

type TabId = (typeof TABS)[number]['id']

export function ProductShop({ products, emptyMessage }: ProductShopProps) {
  const [tab, setTab] = React.useState<TabId>('all')

  const filtered = React.useMemo(() => {
    if (tab === 'all') return products
    if (tab === 'nouveautes') return products.filter((p) => p.badge === 'Nouveau')
    return products.filter((p) => p.slugCategory === tab)
  }, [tab])

  return (
    <section className="mx-auto w-full max-w-7xl px-fib-3 pb-fib-6 md:px-fib-4 md:pb-fib-7">
      <div className="flex items-center justify-between gap-fib-2">
        <p className="text-eyebrow uppercase text-text-muted">Catalogue complet</p>
        <p className="tabular text-xs text-text-muted">
          {filtered.length} {filtered.length === 1 ? 'pièce' : 'pièces'}
        </p>
      </div>

      {/* Category tabs */}
      <div className="no-scrollbar -mx-fib-3 mt-fib-3 flex gap-fib-2 overflow-x-auto pb-1 md:mx-0">
        {TABS.map((item) => {
          const active = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-pressed={active}
              className={cn(
                'press shrink-0 rounded-full px-fib-2 py-fib-1 text-[13px] font-medium transition-colors duration-200',
                active
                  ? 'bg-ink text-white'
                  : 'bg-ink/[0.05] text-ink/70 hover:bg-ink/[0.09] hover:text-ink'
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      {/* key={tab} replays the stagger reveal when the filter changes */}
      <ProductGrid
        key={tab}
        products={filtered}
        emptyMessage={emptyMessage}
        className="mt-fib-4 grid grid-cols-2 gap-x-fib-2 gap-y-fib-4 md:grid-cols-3 md:gap-x-fib-3 lg:grid-cols-4"
      />
    </section>
  )
}
