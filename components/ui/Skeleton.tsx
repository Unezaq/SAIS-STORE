import { cn } from '@/lib/utils'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rect' | 'circle' | 'card'
}

export function Skeleton({ className, variant = 'rect', ...props }: SkeletonProps) {
  const variantStyles = {
    rect: 'rounded-xl',
    circle: 'rounded-full',
    card: 'rounded-2xl',
  }

  return (
    <div
      className={cn(
        'animate-pulse bg-[#EFE9E0]/80',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  )
}

