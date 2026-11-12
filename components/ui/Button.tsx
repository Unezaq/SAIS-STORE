'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

/**
 * Pill button. Feedback is on pointer-down (`.press:active`), so the surface
 * reacts the instant the finger lands instead of waiting for click.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'press inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-[-0.01em] select-none disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background'

    const sizeStyles = {
      sm: 'text-[13px] px-4 h-9',
      md: 'text-sm px-5 h-11',
      lg: 'text-[15px] px-7 h-[52px]',
    }

    const variantStyles = {
      primary: 'bg-primary text-white hover:bg-primary-light',
      secondary: 'bg-ink/[0.06] text-ink hover:bg-ink/[0.1]',
      outline:
        'border border-ink/15 bg-transparent text-ink hover:border-ink/30 hover:bg-ink/[0.03]',
      ghost: 'text-text-muted hover:text-ink hover:bg-ink/[0.05]',
      danger: 'bg-rose-600 text-white hover:bg-rose-700',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-current" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    )
  }
)

Button.displayName = 'Button'
