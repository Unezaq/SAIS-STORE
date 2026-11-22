'use client'

import { useCallback, useState } from 'react'
import { formatMAD } from '@/lib/utils'
import { ProductGallery } from '@/components/storefront/ProductGallery'
import { ProductActions, type ProductColor } from '@/components/storefront/ProductActions'
import { Badge } from '@/components/ui/Badge'

interface ProductMediaAndActionsProps {
  product: {
    slug: string
    title: string
    price: number
    imageUrl: string
    originalPrice?: number
    ref?: string
    sizes?: string[]
    colors?: ProductColor[]
    colorImages?: Record<string, string>
    badge?: string
    categoryName: string
  }
  images: string[]
  deliveryFee: number
  freeDeliveryMinItems: number
  whatsappPhone: string
}

/**
 * Composes the product gallery, badge, header (category, title, price) and
 * product actions into a single interactive unit. Owns the gallery selection
 * state so that color chips in ProductActions can synchronize the main photo
 * through React state — no DOM manipulation.
 */
export function ProductMediaAndActions({
  product,
  images,
  deliveryFee,
  freeDeliveryMinItems,
  whatsappPhone,
}: ProductMediaAndActionsProps) {
  const [galleryIndex, setGalleryIndex] = useState(0)

  const handleColorChange = useCallback(
    (nextColor: string | null) => {
      if (!nextColor || !product.colorImages) return
      const target = product.colorImages[nextColor]
      if (!target) return
      const index = [
        product.imageUrl,
        ...Object.values(product.colorImages ?? {}),
      ].findIndex((src) => src === target)
      if (index >= 0) setGalleryIndex(index)
    },
    [product]
  )

  const onSale =
    product.originalPrice !== undefined && product.originalPrice > product.price
  const discountPercent = onSale && product.originalPrice
    ? Math.round(
        ((product.originalPrice - product.price) / product.originalPrice) * 100
      )
    : 0

  return (
    <div className="gap-8 md:gap-12 lg:grid lg:grid-cols-12">
      <div className="relative lg:col-span-6">
        {product.badge && (
          <div className="absolute top-4 start-4 z-20">
            <Badge variant="primary" size="sm">{product.badge}</Badge>
          </div>
        )}
        <ProductGallery
          images={images}
          alt={product.title}
          colorImages={product.colorImages}
          selectedIndex={galleryIndex}
          onSelect={setGalleryIndex}
        />
      </div>

      <div className="lg:col-span-6 flex flex-col gap-6">
        <div>
          <span className="text-eyebrow uppercase text-text-muted">
            {product.categoryName}
          </span>
          <h1 className="mt-2 mb-3 text-title text-ink">{product.title}</h1>
          <div className="flex items-baseline gap-3 md:gap-4 mb-1">
            <span className="tabular text-xl font-semibold text-ink md:text-2xl">
              {formatMAD(product.price)}
            </span>
            {onSale && product.originalPrice && (
              <>
                <span className="text-sm text-text-muted/70 line-through">
                  {formatMAD(product.originalPrice)}
                </span>
                <span className="text-xs font-bold text-rose-600">
                  -{discountPercent}%
                </span>
              </>
            )}
          </div>
        </div>

        <ProductActions
          product={product}
          deliveryFee={deliveryFee}
          freeDeliveryMinItems={freeDeliveryMinItems}
          onColorChange={handleColorChange}
        />
      </div>
    </div>
  )
}
