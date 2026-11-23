'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Gift, Sparkles, Truck } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'

const STORAGE_KEY = 'sais-welcome-seen-v1'
const HIDDEN_PREFIXES = ['/checkout', '/confirmation', '/compte', '/admin']

const perks = [
  { icon: Gift, label: 'Offres réservées à nos clientes fidèles' },
  { icon: Sparkles, label: 'Nouveautés en avant-première' },
  { icon: Truck, label: 'Commande sans compte toujours possible' },
]

/**
 * First-visit welcome. Shown once per browser (localStorage), never on the
 * checkout, confirmation or account screens where it would interrupt a task.
 */
export function WelcomeDialog() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return

    let alreadySeen: string | null = null
    try {
      alreadySeen = window.localStorage.getItem(STORAGE_KEY)
    } catch {
      alreadySeen = null
    }
    if (alreadySeen) return

    const timer = window.setTimeout(() => setOpen(true), 900)
    return () => window.clearTimeout(timer)
  }, [pathname])

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Private mode: the popup simply shows again next visit.
    }
    setOpen(false)
  }

  return (
    <Sheet
      open={open}
      onClose={dismiss}
      title="Bienvenue chez SAIS 🤍"
      description="Votre boutique de nuit à Kenitra — merci de nous rendre visite."
    >
      <div className="flex flex-col gap-fib-3 pt-1">
        <div>
          <p className="text-sm leading-relaxed text-text-muted">
            Vous êtes ici chez vous. Créez votre compte en 30 secondes et profitez
            d&apos;avantages réservés à nos clientes fidèles.
          </p>
        </div>

        <ul className="flex flex-col gap-2 rounded-2xl bg-surface-soft p-4">
          {perks.map((perk) => {
            const Icon = perk.icon
            return (
              <li key={perk.label} className="flex items-center gap-3 text-sm text-ink">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-primary">
                  <Icon size={15} strokeWidth={1.8} />
                </span>
                {perk.label}
              </li>
            )
          })}
        </ul>

        <div className="flex flex-col gap-2">
          <Link
            href="/compte?mode=inscription"
            onClick={dismiss}
            className="press inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-white hover:bg-primary-light"
          >
            Créer mon compte
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="press inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium text-text-muted hover:bg-ink/[0.04] hover:text-ink"
          >
            Non merci, commander sans compte
          </button>
        </div>

        <p className="text-center text-xs leading-relaxed text-text-muted">
          Aucun compte n&apos;est nécessaire pour passer commande.
        </p>
      </div>
    </Sheet>
  )
}
