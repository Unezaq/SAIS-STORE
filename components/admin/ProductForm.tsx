'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { saveProductAction } from '@/actions/admin'
import type { Product, ProductColor } from '@/lib/data'

/* ------------------------------------------------------------------ */
/* Palette de couleurs courantes pour les vêtements féminins (Maroc)     */
/* ------------------------------------------------------------------ */
const CLOTHING_COLORS: ProductColor[] = [
  { name: 'Rose', hex: '#F2C6D4' },
  { name: 'Rose Poudré', hex: '#F5D0C5' },
  { name: 'Rouge', hex: '#C0392B' },
  { name: 'Bordeaux', hex: '#722F37' },
  { name: 'Corail', hex: '#FF6F61' },
  { name: 'Pêche', hex: '#FFDAB9' },
  { name: 'Orange', hex: '#E67E22' },
  { name: 'Jaune', hex: '#F1C40F' },
  { name: 'Moutarde', hex: '#D4AC0D' },
  { name: 'Vert', hex: '#27AE60' },
  { name: 'Vert Olive', hex: '#6B8E23' },
  { name: 'Vert Menthe', hex: '#98FB98' },
  { name: 'Bleu', hex: '#2980B9' },
  { name: 'Bleu Marine', hex: '#1B3A5C' },
  { name: 'Bleu Ciel', hex: '#87CEEB' },
  { name: 'Violet', hex: '#8E44AD' },
  { name: 'Lavande', hex: '#E6E6FA' },
  { name: 'Gris', hex: '#95A5A6' },
  { name: 'Gris Foncé', hex: '#5D6D7E' },
  { name: 'Noir', hex: '#1C1C1C' },
  { name: 'Blanc', hex: '#FFFFFF' },
  { name: 'Beige', hex: '#F5F5DC' },
  { name: 'Camel', hex: '#C19A6B' },
  { name: 'Marron', hex: '#795548' },
  { name: 'Crème', hex: '#FFFDD0' },
]

const CATEGORIES = [
  { label: 'Peignoirs', slug: 'peignoirs', name: 'Peignoirs' },
  { label: 'Pyjamas Polaires', slug: 'pyjamas', name: 'Pyjamas Polaires' },
  { label: 'Ensembles Hiver', slug: 'ensembles', name: 'Ensembles Hiver' },
]

interface ColorEntry {
  color: ProductColor
  imageUrl: string
}

export function ProductForm({ initial }: { initial?: Product }) {
  const router = useRouter()
  const { success, error: showError } = useToast()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Build initial color entries from product data
  const [colorEntries, setColorEntries] = useState<ColorEntry[]>(() => {
    if (!initial?.colors) return []
    return initial.colors.map((c) => ({
      color: c,
      imageUrl: initial.colorImages?.[c.name] ?? initial.imageUrl ?? '',
    }))
  })

  // Main image
  const [mainImage, setMainImage] = useState(initial?.imageUrl ?? '')
  const [showPalette, setShowPalette] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const colorFileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingColor, setUploadingColor] = useState<string | null>(null)

  async function uploadFile(file: File): Promise<string | null> {
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.ok) return data.url
      showError('Upload échoué', data.error)
      return null
    } catch {
      showError('Upload échoué', 'Vérifiez votre connexion.')
      return null
    }
  }

  async function handleMainImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const url = await uploadFile(file)
    if (url) setMainImage(url)
    setUploading(false)
    e.target.value = ''
  }

  async function handleColorImageUpload(colorName: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingColor(colorName)
    const url = await uploadFile(file)
    if (url) updateColorImage(colorName, url)
    setUploadingColor(null)
    e.target.value = ''
  }

  function toggleColor(color: ProductColor) {
    setColorEntries((prev) => {
      const exists = prev.find((e) => e.color.name === color.name)
      if (exists) {
        return prev.filter((e) => e.color.name !== color.name)
      }
      return [...prev, { color, imageUrl: mainImage || '' }]
    })
  }

  function updateColorImage(colorName: string, url: string) {
    setColorEntries((prev) =>
      prev.map((e) => (e.color.name === colorName ? { ...e, imageUrl: url } : e))
    )
  }

  function removeColor(colorName: string) {
    setColorEntries((prev) => prev.filter((e) => e.color.name !== colorName))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const form = e.currentTarget

    // Build colors JSON and colorImages JSON from our state
    const colorsJson = JSON.stringify(colorEntries.map((e) => e.color))
    const colorImagesJson = JSON.stringify(
      Object.fromEntries(
        colorEntries
          .filter((e) => e.imageUrl.trim())
          .map((e) => [e.color.name, e.imageUrl.trim()])
      )
    )

    // Set hidden fields
    const colorsField = form.querySelector<HTMLInputElement>('input[name="colors"]')
    const colorImagesField = form.querySelector<HTMLInputElement>('input[name="colorImages"]')
    if (colorsField) colorsField.value = colorsJson
    if (colorImagesField) colorImagesField.value = colorImagesJson

    try {
      const formData = new FormData(form)
      const result = await saveProductAction(formData)
      if (!result?.ok) {
        setError('Erreur lors de la sauvegarde.')
        showError("Échec de l'enregistrement", result?.error ?? 'Réessayez ou vérifiez votre connexion.')
        return
      }
      success('Produit enregistré', 'Le produit est maintenant en ligne.')
      router.push('/admin/products')
      router.refresh()
    } catch {
      setError('Erreur lors de la sauvegarde.')
      showError("Échec de l'enregistrement", 'Réessayez ou vérifiez votre connexion.')
    } finally {
      setPending(false)
    }
  }

  const selectedColorNames = new Set(colorEntries.map((e) => e.color.name))

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-fib-4">
      <input type="hidden" name="id" defaultValue={initial?.id ?? ''} />
      <input type="hidden" name="colors" defaultValue="" />
      <input type="hidden" name="colorImages" defaultValue="" />

      {/* ---- Informations de base ---- */}
      <div className="grid gap-fib-3 md:grid-cols-2">
        <Input label="Titre" name="title" defaultValue={initial?.title} required />
        <Input label="Slug (URL)" name="slug" defaultValue={initial?.slug} required />
      </div>

      <div className="grid gap-fib-3 md:grid-cols-3">
        <Input label="Prix (MAD)" name="price" type="number" defaultValue={initial?.price} required />
        <Input label="Prix barré (MAD)" name="originalPrice" type="number" defaultValue={initial?.originalPrice} />
        <div className="flex flex-col gap-1.5">
          <label className="text-eyebrow uppercase text-text-muted">Famille</label>
          <select
            name="slugCategory"
            defaultValue={initial?.slugCategory ?? 'ensembles'}
            className="rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink"
          >
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>{c.label}</option>
            ))}
          </select>
          <Input label="Nom famille" name="categoryName" defaultValue={initial?.categoryName} />
        </div>
      </div>

      {/* ---- Image principale ---- */}
      <div className="flex flex-col gap-1.5">
        <label className="text-eyebrow uppercase text-text-muted">Image principale</label>
        <div className="flex items-center gap-3">
          {mainImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mainImage}
              alt="Aperçu"
              className="h-16 w-16 rounded-xl object-cover ring-1 ring-hairline"
            />
          )}
          <div className="flex-1 flex flex-col gap-2">
            <Input
              label=""
              name="imageUrl"
              value={mainImage}
              onChange={(e) => setMainImage(e.target.value)}
              placeholder="/products/sais-01.jpg ou https://..."
              required
              className="flex-1"
            />
            <label className="press inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-xs font-medium text-ink hover:bg-surface-soft cursor-pointer w-fit">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M7 1v12M1 7h12" />
              </svg>
              {uploading ? 'Upload…' : 'Télécharger une image'}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleMainImageUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>
        </div>
        <p className="text-xs text-text-muted">
          Entrez le chemin (/products/…) ou une URL HTTPS. Cette image sera utilisée
          par défaut pour les coloris sans image spécifique.
        </p>
      </div>

      <Input label="Référence fournisseur" name="ref" defaultValue={initial?.ref} />
      <Input label="Matière" name="fabric" defaultValue={initial?.fabric} />
      <Input label="Badge (Nouveau, Populaire…)" name="badge" defaultValue={initial?.badge} />

      <div className="flex flex-col gap-1.5">
        <label className="text-eyebrow uppercase text-text-muted">Description</label>
        <textarea
          name="description"
          defaultValue={initial?.description}
          rows={3}
          className="rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink"
        />
      </div>

      <Input
        label="Tailles (séparées par virgule)"
        name="sizes"
        defaultValue={initial?.sizes?.join(', ')}
        placeholder="M, L, XL, XXL"
      />

      {/* ---- Coloris et images par coloris ---- */}
      <div className="rounded-2xl border border-hairline bg-surface-soft/30 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-heading text-ink">Coloris et images</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Sélectionnez les coloris disponibles, puis associez une image à chaque
              coloris. Cliquez sur la palette pour ajouter/retirer un coloris.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPalette((v) => !v)}
            className="press inline-flex items-center gap-1.5 rounded-full border border-hairline px-4 py-2 text-xs font-medium text-ink hover:bg-surface-soft"
          >
            {showPalette ? 'Masquer la palette' : 'Choisir les coloris'}
          </button>
        </div>

        {/* Palette de couleurs */}
        {showPalette && (
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 p-3 rounded-xl bg-white border border-hairline">
            {CLOTHING_COLORS.map((color) => {
              const selected = selectedColorNames.has(color.name)
              return (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => toggleColor(color)}
                  title={color.name}
                  className={`relative flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all ${
                    selected
                      ? 'bg-primary/10 ring-2 ring-primary'
                      : 'hover:bg-surface-soft'
                  }`}
                >
                  <span
                    className="h-7 w-7 rounded-full ring-1 ring-hairline shadow-sm"
                    style={{
                      backgroundColor: color.hex,
                      border: color.hex === '#FFFFFF' ? '1px solid #ddd' : 'none',
                    }}
                  />
                  <span className="text-[9px] text-text-muted leading-tight text-center truncate w-full">
                    {color.name}
                  </span>
                  {selected && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-white flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 4l2 2 4-4" />
                      </svg>
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Coloris sélectionnés */}
        {colorEntries.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-text-muted uppercase tracking-[0.1em]">
              {colorEntries.length} coloris sélectionné{colorEntries.length > 1 ? 's' : ''}
            </p>
            {colorEntries.map((entry) => (
              <div
                key={entry.color.name}
                className="flex items-start gap-3 rounded-xl bg-white p-3 border border-hairline"
              >
                {/* Color swatch */}
                <span
                  className="h-10 w-10 shrink-0 rounded-full ring-1 ring-hairline shadow-sm mt-1"
                  style={{
                    backgroundColor: entry.color.hex,
                    border: entry.color.hex === '#FFFFFF' ? '1px solid #ddd' : 'none',
                  }}
                />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink">{entry.color.name}</p>
                    <button
                      type="button"
                      onClick={() => removeColor(entry.color.name)}
                      className="press text-xs text-rose-600 hover:text-rose-700"
                    >
                      Retirer
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.imageUrl}
                        alt={entry.color.name}
                        className="h-10 w-10 rounded-lg object-cover ring-1 ring-hairline shrink-0"
                      />
                    )}
                    <input
                      type="text"
                      value={entry.imageUrl}
                      onChange={(e) => updateColorImage(entry.color.name, e.target.value)}
                      placeholder="URL de l'image pour ce coloris"
                      className="flex-1 rounded-xl border border-hairline bg-white px-3 py-2 text-xs text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                    <label className="press inline-flex items-center gap-1 rounded-full border border-hairline px-3 py-1.5 text-[10px] font-medium text-ink hover:bg-surface-soft cursor-pointer shrink-0">
                      {uploadingColor === entry.color.name ? '…' : '↑'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={(e) => handleColorImageUpload(entry.color.name, e)}
                        className="hidden"
                        disabled={uploadingColor === entry.color.name}
                      />
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {colorEntries.length === 0 && !showPalette && (
          <p className="text-xs text-text-muted text-center py-4">
            Aucun coloris sélectionné. Cliquez sur « Choisir les coloris » pour
            ajouter des coloris et leurs images.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-eyebrow uppercase text-text-muted">Caractéristiques (une par ligne)</label>
        <textarea
          name="features"
          defaultValue={initial?.features?.join('\n')}
          rows={4}
          className="rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink"
        />
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" size="lg" isLoading={pending} disabled={pending}>
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={() => router.back()}>
          Annuler
        </Button>
      </div>
    </form>
  )
}
