'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveCouponAction } from '@/actions/admin'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import type { StoreCoupon } from '@/lib/types/store'

export function CouponForm({ coupon }: { coupon?: StoreCoupon }) {
  const router = useRouter()
  const { success, error: showError } = useToast()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      const result = await saveCouponAction(new FormData(event.currentTarget))
      if (!result.ok) {
        setError(result.error)
        showError('Échec de l’enregistrement', result.error)
        return
      }

      success(
        coupon ? 'Code mis à jour' : 'Code créé',
        'Le code est disponible en caisse dès maintenant.'
      )
      router.push('/admin/coupons')
      router.refresh()
    } catch {
      setError('Erreur lors de l’enregistrement.')
      showError('Échec de l’enregistrement', 'Réessayez ou vérifiez votre connexion.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-fib-4">
      {coupon && <input type="hidden" name="id" value={coupon.id} />}

      <div className="grid gap-fib-3 md:grid-cols-2">
        <Input
          label="Code (ex. BIENVENUE10)"
          name="code"
          placeholder="BIENVENUE10"
          defaultValue={coupon?.code}
          helperText="Min. 3 caractères, converti en minuscules."
          required
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-eyebrow uppercase text-text-muted">Type de réduction</label>
          <select
            name="type"
            defaultValue={coupon?.type ?? 'percentage'}
            className="rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink"
          >
            <option value="percentage">Pourcentage (%)</option>
            <option value="fixed">Montant fixe (MAD)</option>
          </select>
        </div>
      </div>

      <div className="grid gap-fib-3 md:grid-cols-3">
        <Input
          label="Valeur"
          name="value"
          type="number"
          defaultValue={coupon?.value ?? 10}
          placeholder="10"
          helperText="10 = 10% ou 10,00 dh selon le type"
          required
        />
        <Input
          label="Commande minimum (MAD)"
          name="minOrder"
          type="number"
          defaultValue={coupon?.minOrder ?? 0}
          placeholder="0"
          helperText="Optionnel"
        />
        <Input
          label="Utilisations max"
          name="maxUses"
          type="number"
          defaultValue={coupon?.maxUses}
          placeholder="Optionnel"
          helperText="Laissez vide pour illimité."
        />
      </div>

      <div className="grid gap-fib-3 md:grid-cols-2">
        <Input
          label="Expire le"
          name="expiresAt"
          type="date"
          defaultValue={coupon?.expiresAt ? coupon.expiresAt.slice(0, 10) : undefined}
          helperText="Laissez vide pour illimité."
        />
        <Input
          label="Utilisation par client"
          name="perUserLimit"
          type="number"
          defaultValue={coupon?.perUserLimit}
          placeholder="Optionnel"
          helperText="Ex. 1 pour une fois par client."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-eyebrow uppercase text-text-muted">Actif</label>
        <select
          name="isActive"
          defaultValue={coupon ? String(coupon.isActive) : 'true'}
          className="rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink"
        >
          <option value="true">Oui</option>
          <option value="false">Non (brouillon)</option>
        </select>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="mt-fib-2 flex gap-3">
        <Button type="submit" size="lg" isLoading={pending} disabled={pending}>
          {coupon ? 'Enregistrer les modifications' : 'Créer le code'}
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={() => router.push('/admin/coupons')}>
          Annuler
        </Button>
      </div>
    </form>
  )
}
