'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowDown, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { categories } from '@/lib/data'
import { cn } from '@/lib/utils'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const HERO_VIDEO_SRC = '/videos/hero.mp4'

/**
 * Opening section: the image is held on screen for one extra screen while the
 * copy lifts away, so the first gesture already feels like the site is
 * responding rather than just scrolling.
 */
export interface ScrollHeroProps {
  posterImageUrl?: string | null
}

export function ScrollHero({ posterImageUrl = null }: ScrollHeroProps) {
  const section = useRef<HTMLElement>(null)
  const media = useRef<HTMLDivElement>(null)
  const copy = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  const families = categories.filter((c) => c.slug !== 'all')

  useGSAP(
    () => {
      if (reduceMotion) return

      gsap
        .timeline({
          scrollTrigger: {
            trigger: section.current,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.6,
          },
        })
        .fromTo(
          media.current,
          { yPercent: -2 },
          { yPercent: 2, ease: 'none' },
          0
        )
        .fromTo(
          copy.current,
          { yPercent: 0, opacity: 1 },
          { yPercent: -18, opacity: 0, ease: 'none' },
          0
        )
    },
    { dependencies: [reduceMotion], revertOnUpdate: true }
  )

  const rise = (delay: number) =>
    reduceMotion
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2, delay } }
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { type: 'spring' as const, bounce: 0, duration: 0.9, delay },
        }

  return (
    <section
      ref={section}
      className={cn('relative', reduceMotion ? 'h-[100svh]' : 'h-[190vh]')}
    >
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden bg-ink">
        <div ref={media} className="absolute inset-0 will-change-transform">
          {reduceMotion ? (
            posterImageUrl && (
              <Image
                src={posterImageUrl}
                alt=""
                fill
                priority
                sizes="100vw"
                className="object-cover object-center"
              />
            )
          ) : (
            <video
              className="absolute inset-0 h-full w-full object-cover object-center"
              src={HERO_VIDEO_SRC}
              poster={posterImageUrl ?? undefined}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-hidden
            />
          )}
        </div>

        {/* Readability scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/35 to-ink/10" />

        {/* Meta line */}
        <div className="absolute inset-x-0 top-0 z-10">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 pt-5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/70 md:px-8">
            <span>Collection 2026</span>
            <span className="hidden sm:block">Kenitra . Maroc</span>
          </div>
        </div>

        <div ref={copy} className="absolute inset-x-0 bottom-0 z-10 will-change-transform">
          <div className="mx-auto w-full max-w-7xl px-5 pb-24 md:px-8 md:pb-12">
            <motion.p
              {...rise(0)}
              className="mb-4 flex items-center gap-2 text-eyebrow uppercase text-white/70"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Collection hiver 2026
            </motion.p>

            <motion.h1
              {...rise(0.06)}
              className="max-w-3xl text-display text-white [text-wrap:balance]"
            >
              L&apos;élégance du confort, à la maison.
            </motion.h1>

            <motion.p
              {...rise(0.14)}
              className="mt-4 max-w-lg text-sm leading-relaxed text-white/75 md:text-base"
            >
              Peignoirs, pyjamas polaires et ensembles hiver — tissus ultra doux, coupes
              confortables, livraison partout au Royaume.
            </motion.p>

            <motion.div
              {...rise(0.22)}
              className="mt-7 flex flex-wrap items-center gap-x-2 gap-y-3"
            >
              <Link href="/collections">
                <Button size="lg" rightIcon={<ArrowRight size={16} />}>
                  Voir la collection
                </Button>
              </Link>

              <div className="ms-1 flex flex-wrap items-center gap-1.5">
                {families.map((family) => (
                  <Link
                    key={family.slug}
                    href={`/collections/${family.slug}`}
                    className="press rounded-full bg-white/10 px-3.5 py-2 text-[13px] font-medium text-white/90 backdrop-blur-md hover:bg-white/20"
                  >
                    {family.name}
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="absolute bottom-6 end-5 z-10 hidden justify-center md:flex md:end-8"
        >
          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-white/50">
            Défiler <ArrowDown size={12} className="animate-bounce" />
          </span>
        </motion.div>
      </div>
    </section>
  )
}
