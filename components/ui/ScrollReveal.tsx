'use client'

import { useReducedMotion, motion } from 'motion/react'

/**
 * Reveals its children as they enter the viewport.
 *
 * Above-fold content should NOT be wrapped here — let it paint immediately.
 * Motion is a critically-damped spring (no overshoot) so the reveal reads as
 * settling into place rather than as a scripted animation.
 */
type RevealVariant = 'fade-up' | 'fade-down' | 'zoom'

const revealVariants: Record<
  RevealVariant,
  { hidden: { opacity: number; y?: number; scale?: number }; visible: { opacity: number; y?: number; scale?: number } }
> = {
  'fade-up': {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0 },
  },
  'fade-down': {
    hidden: { opacity: 0, y: -24 },
    visible: { opacity: 1, y: 0 },
  },
  zoom: {
    hidden: { opacity: 0, scale: 0.97 },
    visible: { opacity: 1, scale: 1 },
  },
}

interface ScrollRevealProps {
  children: React.ReactNode
  variant?: RevealVariant
  delay?: number
  once?: boolean
}

export function ScrollReveal({
  children,
  variant = 'fade-up',
  delay = 0,
  once = true,
}: ScrollRevealProps) {
  const reduceMotion = useReducedMotion()
  const { hidden, visible } = revealVariants[variant]

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : hidden}
      whileInView={reduceMotion ? { opacity: 1 } : visible}
      transition={
        reduceMotion
          ? { duration: 0.2, delay }
          : { type: 'spring', bounce: 0, duration: 0.6, delay }
      }
      viewport={{ once, amount: 0.18 }}
      className="min-h-[1px]"
    >
      {children}
    </motion.div>
  )
}
