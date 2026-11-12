'use client'

import * as React from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}

/**
 * Bottom sheet on mobile, centered panel on desktop.
 *
 * Enter/exit travel along the same path (§7 spatial consistency), the panel is
 * draggable at any moment and the dismiss decision uses the gesture's velocity,
 * not just its position — a quick flick closes it even if it barely moved.
 */
export function Sheet({ open, onClose, title, description, children, className }: SheetProps) {
  const reduceMotion = useReducedMotion()

  React.useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const panelMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { y: '100%' },
        animate: { y: 0 },
        exit: { y: '100%' },
      }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.15 : 0.28, ease: [0.32, 0.72, 0, 1] }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/30 backdrop-blur-[3px]"
          />

          {/* Sheet / panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            data-lenis-prevent
            {...panelMotion}
            transition={
              reduceMotion
                ? { duration: 0.15 }
                : { type: 'spring', bounce: 0.12, duration: 0.38 }
            }
            drag={reduceMotion ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.08}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose()
            }}
            className={cn(
              'material-raised relative z-10 flex w-full flex-col overflow-hidden bg-surface shadow-[0_-8px_40px_rgba(16,32,26,0.12)]',
              'max-h-[92dvh] rounded-t-[28px]',
              'md:max-h-[85vh] md:max-w-lg md:rounded-[28px] md:shadow-[0_24px_80px_rgba(16,32,26,0.18)]',
              className
            )}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Grab handle for touch affordance */}
            <div className="flex w-full cursor-grab justify-center pt-3 pb-1 active:cursor-grabbing md:hidden">
              <div className="h-1.5 w-10 rounded-full bg-ink/15" />
            </div>

            {/* Header */}
            {(title || description) && (
              <div className="flex items-start justify-between gap-4 px-6 pt-4 pb-3">
                <div className="text-start">
                  {title && <h2 className="text-heading text-ink">{title}</h2>}
                  {description && (
                    <p className="mt-1 text-xs leading-relaxed text-text-muted">{description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="press -me-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/[0.05] text-text-muted hover:bg-ink/[0.09] hover:text-ink"
                  aria-label="Fermer"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Content body */}
            <div
              data-lenis-prevent
              className="flex-1 overflow-y-auto overscroll-contain px-6 pt-1 pb-6"
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
