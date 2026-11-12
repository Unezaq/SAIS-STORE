'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useReducedMotion } from 'motion/react'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { categories, PRODUCTS_SEED } from '@/lib/data'
import type { Product } from '@/lib/data'

export interface CategoryRailProps {
  products?: Product[]
}
import { formatMAD, cn } from '@/lib/utils'

gsap.registerPlugin(useGSAP, ScrollTrigger)

/**
 * Sticky section that turns vertical scroll into a horizontal rail of the
 * products themselves.
 *
 * The sticky container (not a GSAP pin) does the holding, so the layout stays
 * native and nothing fights Lenis. The track is translated by the section's
 * own scroll progress.
 */
export function CategoryRail({ products = PRODUCTS_SEED }: CategoryRailProps) {
  const section = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const progress = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  /*
   * Home shows the highlights only: badged pieces first, then the strongest
   * staples, capped at twelve. The complete catalogue lives on /boutique.
   */
  const TOP_RAIL_COUNT = 12
  const railProducts = [
    ...products.filter((p) => Boolean(p.badge)),
    ...products.filter((p) => !p.badge),
  ].slice(0, TOP_RAIL_COUNT)

  useGSAP(
    () => {
      if (reduceMotion) return

      const distance = () =>
        Math.max(0, (track.current?.scrollWidth ?? 0) - window.innerWidth)

      gsap.to(track.current, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: section.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.4,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (progress.current) {
              gsap.set(progress.current, { scaleX: self.progress })
            }
          },
        },
      })
    },
    { dependencies: [reduceMotion], revertOnUpdate: true }
  )

  return (
    <section
      ref={section}
      className={cn(
        'relative bg-surface-soft',
        reduceMotion ? 'py-fib-5 md:py-fib-6' : 'h-[380vh] md:h-[280vh]'
      )}
    >
      <div
        className={cn(
          'w-full overflow-hidden',
          reduceMotion ? 'relative' : 'sticky top-0 flex h-[100svh] flex-col justify-center'
        )}
      >
        <div className="mx-auto w-full max-w-7xl px-fib-3 md:px-fib-4">
          <div className="flex flex-wrap items-end justify-between gap-fib-2">
            <div>
              <p className="text-eyebrow uppercase text-text-muted">Ce qu&apos;on propose</p>
              <h2 className="mt-fib-1 text-title text-ink">Les pièces, une à une.</h2>
            </div>
            <p className="hidden max-w-[220px] text-xs leading-relaxed text-text-muted md:block">
              Faites défiler pour parcourir les pièces vedettes — la boutique complète est sur
              sa page.
            </p>
          </div>

          <div className="mt-fib-3 h-px w-full bg-ink/10">
            <div
              ref={progress}
              className="h-px w-full origin-left scale-x-0 bg-ink"
              aria-hidden
            />
          </div>
        </div>

        <div className={cn('mt-fib-3 md:mt-fib-4', reduceMotion && 'overflow-x-auto no-scrollbar')}>
          <div
            ref={track}
            className="rail-pad flex w-max gap-3 will-change-transform md:gap-5"
          >
            {railProducts.map((product, index) => (
              <Link
                key={product.id}
                href={`/products/${product.slug}`}
                className="group relative block h-[46vh] w-[64vw] shrink-0 overflow-hidden rounded-[26px] bg-ink md:h-[56vh] md:w-[26vw] lg:w-[23vw] xl:w-[21vw]"
              >
                <Image
                  src={product.imageUrl}
                  alt={product.title}
                  fill
                  sizes="(max-width: 768px) 64vw, 24vw"
                  className="object-cover object-center transition-transform duration-[900ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-ink/25" />

                <span className="tabular absolute start-4 top-4 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="absolute end-4 top-4 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-white backdrop-blur-md">
                  {product.categoryName}
                </span>

                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-fib-2 p-fib-3 md:p-fib-3">
                  <div className="text-start">
                    <h3 className="max-w-[12em] text-lg font-semibold leading-tight tracking-[-0.02em] text-white md:text-xl">
                      {product.title}
                    </h3>
                    <p className="tabular mt-fib-1 text-sm font-semibold text-white/90">
                      {formatMAD(product.price)}
                      {product.originalPrice && product.originalPrice > product.price && (
                        <span className="ms-2 text-xs font-normal text-white/50 line-through">
                          {formatMAD(product.originalPrice)}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-ink transition-transform duration-300 group-hover:rotate-45">
                    <ArrowUpRight size={17} />
                  </span>
                </div>
              </Link>
            ))}

            {/* End panel — closes the rail on the full boutique */}
            <Link
              href="/boutique"
              className="group flex h-[46vh] w-[64vw] shrink-0 flex-col justify-between overflow-hidden rounded-[26px] bg-primary p-fib-3 text-white md:h-[56vh] md:w-[26vw] lg:w-[22vw] xl:w-[20vw] md:p-fib-4"
            >
              <span className="text-eyebrow uppercase text-white/60">La boutique</span>
              <div className="text-start">
                <h3 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] md:text-[34px]">
                  Toutes les pièces
                </h3>
                <p className="mt-fib-1 text-sm text-white/65">{categories[0].count} disponibles</p>
                <span className="mt-fib-3 inline-flex items-center gap-2 text-sm font-medium">
                  Ouvrir la boutique
                  <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
