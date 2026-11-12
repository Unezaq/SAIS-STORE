'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { saveSettingsAction } from '@/actions/admin'
import type { StoreSettings } from '@/lib/store'

export function SettingsForm({ initial }: { initial: StoreSettings }) {
  const { success, error: showError } = useToast()
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    try {
      const formData = new FormData(e.currentTarget)
    await saveSettingsAction(formData)
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
      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" isLoading={pending} disabled={pending}>
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        {saved && <span className="text-sm text-green-600">Enregistré ✓</span>}
      </div>
    </form>
  )
}
