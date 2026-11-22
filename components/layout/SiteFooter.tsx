import Link from 'next/link'
import { ArrowUpRight, MessageCircle } from 'lucide-react'

const families = [
  { label: 'Peignoirs', href: '/collections/peignoirs' },
  { label: 'Pyjamas Polaires', href: '/collections/pyjamas' },
  { label: 'Ensembles Hiver', href: '/collections/ensembles' },
]

/**
 * Sticky footer: the page surface scrolls over it, so it reads as the ground
 * the site rests on rather than another block of content.
 */
export function SiteFooter({
  whatsappPhone,
  deliveryFee,
  freeDeliveryMinItems,
}: {
  whatsappPhone: string
  deliveryFee: number
  freeDeliveryMinItems: number
}) {
  const help = [
    { label: 'La boutique', href: '/boutique' },
    { label: 'Promotions', href: '/promotions' },
    { label: 'Nouveautés', href: '/collections/nouveautes' },
    { label: 'Espace client', href: '/espace-client' },
    { label: 'Suivre ma commande', href: '/suivre' },
    { label: 'Contact', href: '/contact' },
    { label: 'FAQ', href: '/faq' },
    { label: 'Livraison', href: '/livraison' },
    { label: 'Retours et échanges', href: '/retours' },
    { label: 'Confidentialité', href: '/confidentialite' },
    { label: 'Conditions de vente', href: '/conditions' },
    { label: 'Nous écrire', href: `https://wa.me/${whatsappPhone}` },
  ]

  return (
    <footer className="sticky bottom-0 z-0 bg-primary-dark text-white">
      <div className="mx-auto w-full max-w-7xl px-5 pb-28 pt-14 md:px-8 md:pb-12 md:pt-20">
        <div className="grid gap-10 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-5">
            <p className="text-[17px] font-semibold uppercase tracking-[0.2em]">SAIS</p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
              Vêtements d&apos;intérieur marocains — peignoirs, pyjamas polaires et ensembles
              hiver ultra doux. Commande sur WhatsApp avec paiement à la livraison.
            </p>
            <a
              href={`https://wa.me/${whatsappPhone}`}
              target="_blank"
              rel="noreferrer"
              className="press mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-md hover:bg-white/15"
            >
              <MessageCircle size={16} />
              Commander sur WhatsApp
            </a>
          </div>

          <nav className="md:col-span-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Collections
            </p>
            <ul className="mt-4 space-y-2.5">
              {families.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-white/70 transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="md:col-span-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Aide
            </p>
            <ul className="mt-4 space-y-2.5">
              {help.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group inline-flex items-center gap-1 text-sm text-white/70 transition-colors hover:text-white"
                  >
                    {item.label}
                    <ArrowUpRight
                      size={13}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-[11px] text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 SAIS Store — Kenitra, Maroc</p>
          <p>
            Paiement à la livraison · {deliveryFee > 0 ? `Livraison ${deliveryFee} MAD` : 'Livraison gratuite'}
            {freeDeliveryMinItems > 0 && ` · offerte dès ${freeDeliveryMinItems} pièces`} · 24–48h
          </p>
        </div>
      </div>
    </footer>
  )
}
