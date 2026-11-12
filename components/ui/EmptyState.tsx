import * as React from 'react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'mx-auto flex max-w-md flex-col items-center justify-center rounded-3xl bg-surface-soft p-8 text-center',
        className
      )}
    >
      {icon && (
        <div className="mb-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink/[0.05] text-ink">
          {icon}
        </div>
      )}
      <h3 className="mb-1 text-heading text-ink">{title}</h3>
      {description && <p className="mb-5 max-w-xs text-xs leading-relaxed text-text-muted">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  )
}

