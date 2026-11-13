'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { saveSettingsAction } from '@/actions/admin'
import type { StoreSettings } from '@/lib/types/store'

export function SettingsForm({ initial }: { initial: StoreSettings }) {
  const { success, error: showError } = useToast()
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    try {
      const formData = new FormData(e.currentTarget)
      const result = await saveSettingsAction(formData)
      if (!result.ok) {
        showError("Échec de l'enregistrement", result.error)
        return
      }
      success('Paramètres enregistrés', 'Les modifications sont prises en compte.')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      showError("Échec de l'enregistrement", 'Réessayez ou vérifiez votre connexion.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-fib-3">
      <Input label="Nom de la boutique" name="storeName" defaultValue={initial.storeName} />
      <Input label="Numéro WhatsApp (sans +)" name="whatsappPhone" defaultValue={initial.whatsappPhone} />
      <Input label="Texte livraison" name="deliveryText" defaultValue={initial.deliveryText} />
      <Input label="Texte paiement" name="paymentText" defaultValue={initial.paymentText} />
      <div className="grid gap-fib-3 md:grid-cols-2">
        <Input
          label="Frais de livraison (MAD)"
          name="deliveryFee"
          type="number"
          min={0}
          max={1000}
          defaultValue={initial.deliveryFee}
        />
        <Input
          label="Livraison gratuite dès X pièces (0 = désactivée)"
          name="freeDeliveryMinItems"
          type="number"
          min={0}
          max={99}
          defaultValue={initial.freeDeliveryMinItems}
        />
      </div>
      <section className="rounded-2xl bg-surface-soft p-fib-3">
        <h2 className="text-sm font-semibold text-ink">Promotion générale temporaire</h2>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">
          Les produits déjà en promotion individuelle ne cumulent pas cette réduction.
          Mettez le pourcentage à 0 pour désactiver.
        </p>
        <div className="mt-fib-3 grid gap-fib-3 md:grid-cols-3">
          <Input
            label="Réduction (%)"
            name="storewideDiscountPercent"
            type="number"
            min={0}
            max={90}
            defaultValue={initial.storewideDiscountPercent}
          />
          <label className="flex flex-col gap-1.5 text-sm text-ink">
            Date de début
            <input
              type="date"
              name="discountStartDate"
              defaultValue={initial.discountStartDate ?? ''}
              className="h-11 rounded-xl border border-hairline bg-white px-4 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-ink">
            Date de fin
            <input
              type="date"
              name="discountEndDate"
              defaultValue={initial.discountEndDate ?? ''}
              className="h-11 rounded-xl border border-hairline bg-white px-4 text-sm"
            />
          </label>
        </div>
      </section>
      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" isLoading={pending} disabled={pending}>
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        {saved && <span className="text-sm text-green-600">Enregistré ✓</span>}
      </div>
    </form>
  )
}
