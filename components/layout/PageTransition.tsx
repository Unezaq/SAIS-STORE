'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { usePathname } from 'next/navigation'
import { useLenis } from 'lenis/react'
import { useEffect } from 'react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Crossfade + settle between storefront routes.
 *
 * The navigation shell stays mounted; only the page content moves, and the
 * outgoing page leaves along the same axis the new one arrives from. Scroll is
 * reset through Lenis so its internal target never drifts out of sync.
 */
const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const lenis = useLenis()
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (lenis) {
      lenis.scrollTo(0, { immediate: true })
    } else {
      window.scrollTo(0, 0)
    }

    // Scroll-triggered sections measure themselves against the new page.
    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 480)
    return () => window.clearTimeout(refresh)
  }, [pathname, lenis])

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={false}
        variants={reduceMotion ? { ...pageVariants, initial: { opacity: 0 }, exit: { opacity: 0 } } : pageVariants}
        animate="animate"
        exit="exit"
        transition={
          reduceMotion
            ? { duration: 0.2 }
            : { duration: 0.42, ease: [0.32, 0.72, 0, 1] }
        }
        className="min-h-dvh"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
