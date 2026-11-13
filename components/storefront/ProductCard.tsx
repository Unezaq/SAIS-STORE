'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Plus, Heart } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { formatMAD, cn } from '@/lib/utils'

export interface ProductCardProps {
  id: string
  title: string
  slug: string
  price: number
  originalPrice?: number
  imageUrl: string
  /** Optional showcase video — plays on hover (desktop) or in view (mobile). */
  videoUrl?: string
  categoryName?: string
  badge?: string
  isLiked?: boolean
  onQuickAdd?: (id: string) => void
  onToggleLike?: (id: string) => void
  className?: string
}

/**
 * Image-first card: no frame, no drop shadow. The photograph is the object and
 * the chrome around it is translucent so it never competes with the product.
 */
export function ProductCard({
  id,
  title,
  slug,
  price,
  originalPrice,
  imageUrl,
  videoUrl,
  categoryName,
  badge,
  isLiked = false,
  onQuickAdd,
  onToggleLike,
  className,
}: ProductCardProps) {
  const [localLiked, setLocalLiked] = React.useState(isLiked)
  // When the parent drives the state (wishlist), its prop is the source of truth.
  const liked = onToggleLike ? isLiked : localLiked

  // Negative delay desynchronises the Ken Burns loop between neighbouring
  // cards, so the grid breathes like a mosaic of clips instead of marching.
  const numericId = Number(id.replace(/\D/g, '')) || 0
  const kenBurnsDelay = `-${numericId % 12}s`

  /**
   * Showcase video: on desktop it plays while hovering the card; on touch
   * devices it plays while the card is well inside the viewport, TikTok-style.
   * The photo underneath acts as poster and fallback, so a slow or missing
   * video never breaks the card.
   */
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [videoActive, setVideoActive] = React.useState(false)

  React.useEffect(() => {
    const video = videoRef.current
    if (!videoUrl || !video) return

    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)')
    let inView = false
    let hovering = false
    let active = false

    const sync = () => {
      const next = canHover.matches ? hovering && inView : inView
      if (next === active) return
      active = next
      setVideoActive(next)
      if (next) video.play().catch(() => {})
      else video.pause()
    }

    const observer = new IntersectionObserver(
      (entries) => {
        inView = entries[0]?.isIntersecting ?? false
        sync()
      },
      { threshold: 0.5 }
    )
    observer.observe(video)

    const onEnter = () => {
      hovering = true
      sync()
    }
    const onLeave = () => {
      hovering = false
      sync()
    }
    const link = video.closest('a')
    link?.addEventListener('mouseenter', onEnter)
    link?.addEventListener('mouseleave', onLeave)

    return () => {
      observer.disconnect()
      link?.removeEventListener('mouseenter', onEnter)
      link?.removeEventListener('mouseleave', onLeave)
    }
  }, [videoUrl])

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!onToggleLike) setLocalLiked(!localLiked)
    onToggleLike?.(id)
  }

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onQuickAdd?.(id)
  }

  const onSale = originalPrice != null && originalPrice > price

  return (
    <div className={cn('group relative flex min-w-0 flex-col', className)}>
      <Link
        href={`/products/${slug}`}
        className="relative block aspect-[3/4] w-full overflow-hidden rounded-[20px] bg-surface-soft"
      >
        <Image
          src={imageUrl}
          alt={title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="animate-kenburns-card object-cover object-center"
          style={{ animationDelay: kenBurnsDelay }}
        />

        {/* Showcase video — photo underneath is the poster/fallback */}
        {videoUrl && (
          <video
            ref={videoRef}
            src={videoUrl}
            className={cn(
              'absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500',
              videoActive ? 'opacity-100' : 'opacity-0'
            )}
            muted
            loop
            playsInline
            preload="none"
            aria-hidden
          />
        )}

        {/* Status */}
        {(badge || onSale) && (
          <div className="absolute start-3 top-3 z-10 flex flex-col items-start gap-1.5">
            {badge && (
              <Badge variant="secondary" size="sm" className="shadow-[0_1px_2px_rgba(16,32,26,0.06)]">
                {badge}
              </Badge>
            )}
            {onSale && (
              <Badge variant="danger" size="sm">
                -{Math.round(((originalPrice - price) / originalPrice) * 100)}%
              </Badge>
            )}
          </div>
        )}

        {/* Wishlist */}
        <button
          type="button"
          onClick={handleLike}
          className="press absolute end-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/75 text-ink backdrop-blur-md hover:bg-white"
          aria-label="Ajouter aux favoris"
          aria-pressed={liked}
        >
          <Heart size={14} className={cn(liked && 'fill-rose-500 text-rose-500')} />
        </button>

        {/* Quick add */}
        <button
          type="button"
          onClick={handleQuickAdd}
          className={cn(
            'press absolute end-3 bottom-3 z-10 flex h-10 w-10 items-center justify-center rounded-full',
            'bg-white/80 text-ink backdrop-blur-md hover:bg-white',
            'md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100'
          )}
          aria-label={`Choisir les options de ${title}`}
          title="Choisir la taille et la couleur"
        >
          <Plus size={17} />
        </button>
      </Link>

      {/* Details */}
      <div className="flex flex-1 flex-col justify-between px-0.5 pt-3 text-start">
        <div>
          {categoryName && (
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted/80">
              {categoryName}
            </p>
          )}
          <Link href={`/products/${slug}`} className="block">
            <h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-ink md:text-sm">
              {title}
            </h3>
          </Link>
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="tabular text-[13px] font-semibold text-ink md:text-sm">
            {formatMAD(price)}
          </span>
          {onSale && (
            <span className="tabular text-xs text-text-muted/60 line-through">
              {formatMAD(originalPrice)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
