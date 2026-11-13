'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { saveProductAction } from '@/actions/admin'
import type { Product } from '@/lib/data'

const CATEGORIES = [
  { label: 'Peignoirs', slug: 'peignoirs', name: 'Peignoirs' },
  { label: 'Pyjamas Polaires', slug: 'pyjamas', name: 'Pyjamas Polaires' },
  { label: 'Ensembles Hiver', slug: 'ensembles', name: 'Ensembles Hiver' },
]

export function ProductForm({ initial }: { initial?: Product }) {
  const router = useRouter()
  const { success, error: showError } = useToast()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)

    try {
      const formData = new FormData(e.currentTarget)
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-fib-4">
      <input type="hidden" name="id" defaultValue={initial?.id ?? `p-${Date.now()}`} />
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
      <Input label="Image principale (chemin)" name="imageUrl" defaultValue={initial?.imageUrl} placeholder="/products/sais-01.jpg" required />
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
      <div className="flex flex-col gap-1.5">
        <label className="text-eyebrow uppercase text-text-muted">
          Coloris JSON — ex: [{`{"name":"Rose","hex":"#F2C6D4"}`}]
        </label>
        <textarea
          name="colors"
          defaultValue={initial?.colors ? JSON.stringify(initial.colors) : ''}
          rows={3}
          className="rounded-xl border border-hairline bg-white px-4 py-2.5 font-mono text-xs text-ink"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-eyebrow uppercase text-text-muted">
          Images par coloris JSON — ex: {`{"Rose":"/products/x.jpg"}`}
        </label>
        <textarea
          name="colorImages"
          defaultValue={initial?.colorImages ? JSON.stringify(initial.colorImages) : ''}
          rows={2}
          className="rounded-xl border border-hairline bg-white px-4 py-2.5 font-mono text-xs text-ink"
        />
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
