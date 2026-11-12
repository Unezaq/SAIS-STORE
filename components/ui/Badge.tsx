import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'danger' | 'warning'
  size?: 'sm' | 'md'
}

/**
 * Quiet status pills. No heavy outlines — tone carries the meaning, and the
 * translucent variants sit on photography without hiding it.
 */
export function Badge({
  className,
  variant = 'primary',
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  const sizeStyles = {
    sm: 'text-[10px] px-2 py-[3px] font-semibold tracking-[0.04em] rounded-full',
    md: 'text-[11px] px-2.5 py-1 font-semibold tracking-[0.02em] rounded-full',
  }

  const variantStyles = {
    primary: 'bg-ink/[0.06] text-ink',
    secondary: 'bg-white/70 text-text-muted backdrop-blur-md',
    accent: 'bg-accent/15 text-[#8A5A33]',
    success: 'bg-emerald-600/10 text-emerald-800',
    danger: 'bg-rose-600 text-white',
    warning: 'bg-amber-500/15 text-amber-900',
  }

  return (
    <span
      className={cn('inline-flex items-center select-none', sizeStyles[size], variantStyles[variant], className)}
      {...props}
    >
      {children}
    </span>
  )
}
