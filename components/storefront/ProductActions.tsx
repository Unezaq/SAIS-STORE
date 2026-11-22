'use client'

import { useCallback, useState } from 'react'
import { formatMAD, cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { useCart } from '@/components/storefront/CartProvider'
import { useToast } from '@/components/ui/Toast'

export interface ProductColor {
  name: string
  hex: string
}

interface ProductActionsProps {
  deliveryFee: number
  freeDeliveryMinItems: number
  /** Optional callback so the parent can synchronize the product gallery when a color is selected. */
  onColorChange?: (color: string | null) => void
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
  }
}

export function ProductActions({
  product,
  deliveryFee,
  freeDeliveryMinItems,
  onColorChange,
}: ProductActionsProps) {
  const [quantity, setQuantity] = useState(1)
  const [size, setSize] = useState<string | null>(product.sizes?.[0] ?? null)
  const [color, setColor] = useState<string | null>(product.colors?.[0]?.name ?? null)
  const [added, setAdded] = useState(false)
  const [pending, setPending] = useState(false)
  const { addItem } = useCart()
  const { show } = useToast()

  const handleAddToCart = useCallback(() => {
    setPending(true)
    addItem({
      slug: product.slug,
      title: product.title,
      imageUrl: product.imageUrl,
      price: product.price,
      quantity,
      size: size ?? undefined,
      color: color ?? undefined,
    })
    setAdded(true)
    show('success', 'Ajouté au panier.', 'Votre pièce a été ajoutée au panier.')
    setTimeout(() => {
      setAdded(false)
      setPending(false)
    }, 1200)
  }, [addItem, show, product, quantity, size, color])

  const handleColorChange = useCallback(
    (nextColor: string | null) => {
      setColor(nextColor)
      onColorChange?.(nextColor)
    },
    [onColorChange]
  )

  return (
    <div className="flex flex-col gap-5">
      {product.colors && product.colors.length > 1 && (
        <div className="flex flex-col gap-2">
          <p className="text-eyebrow uppercase text-text-muted">
            Couleur — <span className="text-ink normal-case tracking-normal">{color}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {product.colors.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => handleColorChange(c.name)}
                aria-pressed={color === c.name}
                aria-label={c.name}
                title={c.name}
                className={cn(
                  'press h-9 w-9 rounded-full border-2 transition-all',
                  color === c.name
                    ? 'border-ink scale-110'
                    : 'border-transparent hover:scale-105'
                )}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
          {/* Note when no photo exists for the selected color. */}
          {color && !product.colorImages?.[color] && (
            <p className="text-xs text-text-muted">
              Coloris disponible sur commande — la photo montre un autre coloris.
            </p>
          )}
        </div>
      )}

      {product.colors && product.colors.length === 1 && (
        <div className="flex flex-col gap-2">
          <p className="text-eyebrow uppercase text-text-muted">Coloris</p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-hairline px-3 py-1.5 text-sm text-ink">
              <span
                className="h-3.5 w-3.5 rounded-full border border-hairline/60"
                style={{ backgroundColor: product.colors[0].hex }}
              />
              {product.colors[0].name}
            </span>
          </div>
        </div>
      )}

      {product.sizes && product.sizes.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-eyebrow uppercase text-text-muted">Taille</p>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                aria-pressed={size === s}
                className={cn(
                  'press rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  size === s
                    ? 'border-ink bg-ink text-white'
                    : 'border-hairline text-ink hover:border-ink/40'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="w-full sm:w-auto">
          <QuantityStepper value={quantity} onChange={setQuantity} min={1} max={10} size="md" />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={pending}
            onClick={handleAddToCart}
          >
            {pending ? 'Ajout en cours…' : 'Ajouter au panier'}
          </Button>
        </div>
      </div>
      {added && (
        <p role="status" className="text-sm font-medium text-primary">
          Ajouté au panier.
        </p>
      )}
      <p className="text-xs text-text-muted">
        {deliveryFee > 0 ? `Livraison ${formatMAD(deliveryFee)}` : 'Livraison gratuite'}
        {freeDeliveryMinItems > 0 && ` · offerte dès ${freeDeliveryMinItems} pièces dans la commande`}
      </p>
    </div>
  )
}
