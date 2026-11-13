'use client'

import Link from 'next/link'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { categories } from '@/lib/data'

export default function CollectionsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-fib-3 pt-fib-4 md:px-fib-4 md:pt-fib-5">
      <div className="mb-fib-4 max-w-2xl md:mb-fib-5">
        <p className="text-eyebrow uppercase text-text-muted">Catalogue</p>
        <h1 className="mt-fib-1 text-title text-ink">Nos collections</h1>
        <p className="mt-fib-2 text-sm leading-relaxed text-text-muted md:text-[15px]">
          Toutes nos pièces cocooning, prêtes à porter au Maroc — peignoirs, pyjamas polaires et
          ensembles d&apos;hiver ultra doux.
        </p>
      </div>

      <ScrollReveal variant="fade-up" delay={0.05}>
        <div className="grid grid-cols-2 gap-fib-2 md:grid-cols-3 md:gap-fib-3 lg:grid-cols-5">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/collections/${c.slug}`}
              className="group relative block aspect-[4/5] overflow-hidden rounded-[20px] bg-surface-soft"
            >
              <img
                src={c.imageUrl}
                alt={c.name}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.04]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 z-10 p-fib-2 text-start">
                <h2 className="text-[15px] font-medium text-white">{c.name}</h2>
              </div>
            </Link>
          ))}
        </div>
      </ScrollReveal>
    </div>
  )
}
