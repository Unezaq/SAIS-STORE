'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import type { Product } from '@/lib/data'
import { formatMAD, cn } from '@/lib/utils'

gsap.registerPlugin(useGSAP, ScrollTrigger)

/**
 * Segmented product story: the visual stays put and swaps as each piece's
 * panel passes the middle of the screen. One image, one price, one action at a
 * time — the visitor always knows exactly what is being offered.
 */
export interface ProductStoryProps {
  products: Product[]
}

export function ProductStory({ products }: ProductStoryProps) {
  const items = products.slice(0, 3)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const steps = useRef<Array<HTMLDivElement | null>>([])

  useGSAP(
    () => {
      const triggers = steps.current
        .filter((el): el is HTMLDivElement => Boolean(el))
        .map((el, index) =>
          ScrollTrigger.create({
            trigger: el,
            start: 'top 65%',
            end: 'bottom 65%',
            onToggle: (self) => {
              if (self.isActive) setActive(index)
            },
          })
        )

      return () => triggers.forEach((trigger) => trigger.kill())
    },
    { scope: root }
  )

  if (items.length === 0) return null

  return (
    <section ref={root} className="mx-auto w-full max-w-7xl px-fib-3 py-fib-6 md:px-fib-4 md:py-fib-7">
      <div className="max-w-2xl">
        <p className="text-eyebrow uppercase text-text-muted">Pièces signature</p>
        <h2 className="mt-fib-1 text-title text-ink">Choisissez votre pièce.</h2>
        <p className="mt-fib-2 text-sm leading-relaxed text-text-muted md:text-[15px]">
          Trois pièces de la collection, avec leur prix et leur matière. Ajoutez-la à votre
          commande en un geste.
        </p>
      </div>

      <div className="mt-fib-4 grid gap-fib-3 md:mt-fib-5 lg:grid-cols-12 lg:gap-fib-4">
        {/* Sticky visual */}
        <div className="sticky top-16 z-10 lg:col-span-6 lg:top-24 lg:self-start">
          <div className="relative h-[42svh] w-full overflow-hidden rounded-[28px] bg-surface-soft md:aspect-[16/10] md:h-auto lg:aspect-[4/5] lg:h-[calc(100svh-8rem)] lg:w-full">
            {items.map((item, index) => (
              <Image
                key={item.id}
                src={item.imageUrl}
                alt={item.title}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className={cn(
                  'object-cover object-center transition-opacity duration-700 motion-reduce:transition-none',
                  index === active ? 'opacity-100' : 'opacity-0'
                )}
              />
            ))}

            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-ink/60 to-transparent" />

            <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3">
              <div className="material-raised rounded-2xl px-4 py-3">
                <p className="tabular text-[10px] uppercase tracking-[0.14em] text-text-muted">
                  0{active + 1} / 0{items.length}
                </p>
                <p className="mt-0.5 text-sm font-medium text-ink">{items[active].title}</p>
              </div>
              <Link
                href={`/products/${items[active].slug}`}
                className="press flex h-11 w-11 items-center justify-center rounded-full bg-white/85 text-ink backdrop-blur-md hover:bg-white"
                aria-label={`Voir ${items[active].title}`}
              >
                <ArrowUpRight size={17} />
              </Link>
            </div>
          </div>
        </div>

        {/* Segments */}
        <div className="flex flex-col lg:col-span-6">
          {items.map((item, index) => (
            <div
              key={item.id}
              ref={(el) => {
                steps.current[index] = el
              }}
              className="flex min-h-[42vh] flex-col justify-center border-t border-hairline py-8 first:border-t-0 lg:min-h-[62vh] lg:py-12"
            >
              <div
                className={cn(
                  'transition-opacity duration-500 motion-reduce:transition-none',
                  index === active ? 'opacity-100' : 'lg:opacity-40'
                )}
              >
                <div className="flex items-baseline gap-3">
                  <span className="tabular text-xs font-medium text-text-muted">0{index + 1}</span>
                  <span className="text-eyebrow uppercase text-text-muted">
                    {item.categoryName}
                  </span>
                </div>

                <h3 className="mt-3 text-[clamp(1.5rem,3.4vw,2.25rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">
                  {item.title}
                </h3>

                <div className="mt-3 flex items-baseline gap-3">
                  <span className="tabular text-lg font-semibold text-ink">
                    {formatMAD(item.price)}
                  </span>
                  {item.originalPrice && item.originalPrice > item.price && (
                    <span className="tabular text-sm text-text-muted/60 line-through">
                      {formatMAD(item.originalPrice)}
                    </span>
                  )}
                </div>

                {item.description && (
                  <p className="mt-4 max-w-md text-sm leading-relaxed text-text-muted">
                    {item.description}
                  </p>
                )}

                <Link
                  href={`/products/${item.slug}`}
                  className="press mt-6 inline-flex items-center gap-2 rounded-full bg-ink/[0.06] px-5 py-2.5 text-sm font-medium text-ink hover:bg-ink/[0.1]"
                >
                  Voir la pièce
                  <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          ))}

          <div className="border-t border-hairline pt-8">
            <Link
              href="/collections"
              className="press inline-flex items-center gap-2 text-sm font-medium text-ink"
            >
              Toute la collection
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
