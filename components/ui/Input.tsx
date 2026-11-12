'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  startIcon?: React.ReactNode
  endIcon?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, startIcon, endIcon, id, ...props }, ref) => {
    const inputId = id || React.useId()

    return (
      <div className="w-full flex flex-col gap-1.5 text-start">
        {label && (
          <label
            htmlFor={inputId}
            className="text-eyebrow uppercase text-text-muted"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {startIcon && (
            <span className="absolute start-3.5 flex items-center pointer-events-none text-text-muted">
              {startIcon}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full bg-surface text-ink text-sm rounded-2xl border border-ink/10 px-4 py-3 placeholder:text-text-muted/60 transition-colors',
              'focus:outline-none focus:border-ink/30 focus:ring-4 focus:ring-ink/[0.06]',
              startIcon && 'ps-10',
              endIcon && 'pe-10',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-100',
              className
            )}
            {...props}
          />
          {endIcon && (
            <span className="absolute end-3.5 flex items-center text-text-muted">
              {endIcon}
            </span>
          )}
        </div>
        {error ? (
          <p className="text-xs text-red-600 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-text-muted">{helperText}</p>
        ) : null}
      </div>
    )
  }
)

Input.displayName = 'Input'

