'use client'

import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface QuantityStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  size = 'md',
  disabled = false,
  className,
}: QuantityStepperProps) {
  const handleDecrement = () => {
    if (value > min) onChange(value - 1)
  }

  const handleIncrement = () => {
    if (value < max) onChange(value + 1)
  }

  const sizeStyles = {
    sm: 'h-8 px-1 text-xs gap-1',
    md: 'h-10 px-1.5 text-sm gap-2',
  }

  const btnStyles = {
    sm: 'w-6 h-6',
    md: 'w-7 h-7',
  }

  return (
    <div
      className={cn(
        'inline-flex items-center justify-between bg-ink/[0.04] rounded-full select-none',
        sizeStyles[size],
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
    >
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min || disabled}
        className={cn(
          'press flex items-center justify-center rounded-full text-ink hover:bg-ink/[0.06] disabled:opacity-30 disabled:pointer-events-none',
          btnStyles[size]
        )}
        aria-label="Diminuer la quantité"
      >
        <Minus size={14} />
      </button>

      <span className="tabular font-semibold text-center min-w-[24px] text-ink">
        {value}
      </span>

      <button
        type="button"
        onClick={handleIncrement}
        disabled={value >= max || disabled}
        className={cn(
          'press flex items-center justify-center rounded-full text-ink hover:bg-ink/[0.06] disabled:opacity-30 disabled:pointer-events-none',
          btnStyles[size]
        )}
        aria-label="Augmenter la quantité"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}

