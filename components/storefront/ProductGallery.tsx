'use client'

import Image from 'next/image'
import * as React from 'react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface ProductGalleryProps {
  /** First image is the main product photo; the rest are lifestyle/detail shots. */
  images: string[]
  alt: string
  /** Optional map of color name -> image src, used to sync with color chips. */
  colorImages?: Record<string, string>
  /** Controlled selection index. When provided, the parent owns gallery state. */
  selectedIndex?: number
  /** Callback fired when a thumbnail is selected. Required when selectedIndex is set. */
  onSelect?: (index: number) => void
}

/**
 * Main photo with a thumbnail rail underneath. The thumbs swap the hero image
 * in place — no lightbox, keeps the buy flow one gesture away.
 *
 * Supports both uncontrolled (internal state) and controlled (parent-owned)
 * selection. In controlled mode the parent drives which image is shown, which
 * lets color chips outside this component synchronize the gallery without DOM
 * manipulation.
 */
export function ProductGallery({
  images,
  alt,
  colorImages,
  selectedIndex,
  onSelect,
}: ProductGalleryProps) {
  const [internalSelected, setInternalSelected] = useState(0)

  // The effective selected index: controlled prop takes precedence.
  const selected = selectedIndex ?? internalSelected

  // Map color name -> index in the images array, so color chips can drive the
  // main photo. Rebuilt whenever the image set changes.
  const colorIndex = React.useMemo(() => {
    const map: Record<string, number> = {}
    if (!colorImages) return map
    for (const [name, src] of Object.entries(colorImages)) {
      const idx = images.findIndex((img) => img === src)
      if (idx >= 0) map[name] = idx
    }
    return map
  }, [images, colorImages])

  const handleSelect = (index: number) => {
    if (onSelect) {
      onSelect(index)
    } else {
      setInternalSelected(index)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[28px] bg-surface-soft">
        <Image
          key={images[selected]}
          src={images[selected]}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover object-center"
          priority
        />
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((src, index) => (
            <button
              key={src}
              type="button"
              onClick={() => handleSelect(index)}
              aria-label={`Photo ${index + 1}`}
              aria-pressed={selected === index}
              className={cn(
                'press relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-xl md:w-20',
                selected === index
                  ? 'ring-2 ring-ink ring-offset-2 ring-offset-background'
                  : 'opacity-80 hover:opacity-100'
              )}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="80px"
                className="object-cover object-center"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
