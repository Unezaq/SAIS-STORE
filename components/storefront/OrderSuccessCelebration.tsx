'use client'

import * as React from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Check } from 'lucide-react'

const CONFETTI_COLORS = ['#ffffff', '#FFE9A8', '#BFE3C6', '#F6C7B0']

/**
 * Success moment on the confirmation page: a small burst, the reassuring
 * "you bought from us" message, and a gentle haptic tap on devices that
 * support the Vibration API (every attempt is guarded — iOS ignores it).
 */
export function OrderSuccessCelebration({
  firstName,
  orderNumber,
}: {
  firstName: string
  orderNumber: string
}) {
  const reduceMotion = useReducedMotion()

  React.useEffect(() => {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
    try {
      navigator.vibrate([60, 45, 120])
    } catch {
      // Haptics are a bonus, never a requirement.
    }
  }, [])

  return (
    <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-primary to-primary-light p-6 text-white">
      {/* Burst — deterministic angles so server and client markup match */}
      {!reduceMotion &&
        Array.from({ length: 14 }).map((_, index) => {
          const angle = (index / 14) * Math.PI * 2
          const distance = 84 + (index % 5) * 14
          const x = Math.cos(angle) * distance
          const y = Math.sin(angle) * distance
          return (
            <motion.span
              key={index}
              aria-hidden
              className="absolute left-7 top-7 h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length] }}
              initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
              animate={{ opacity: [0, 1, 0], scale: [0, 1, 0.4], x, y }}
              transition={{
                duration: 1.1,
                delay: 0.15 + (index % 4) * 0.05,
                ease: [0.32, 0.72, 0, 1],
              }}
            />
          )
        })}

      <div className="relative flex items-start gap-3">
        <motion.span
          initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', bounce: 0.45, duration: 0.6 }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white"
        >
          <Check size={22} strokeWidth={2.4} />
        </motion.span>
        <div>
          <p className="text-eyebrow uppercase text-white/70">Commande réussie</p>
          <h1 className="mt-1 text-title text-white">Félicitations {firstName} 🎉</h1>
        </div>
      </div>

      <p className="relative mt-3 text-sm leading-relaxed text-white/85">
        Vous avez commandé chez SAIS et votre commande{' '}
        <strong className="font-semibold text-white">{orderNumber}</strong> est bien
        enregistrée. Merci de votre confiance — nous vous appelons très vite pour confirmer
        la livraison.
      </p>
    </div>
  )
}
