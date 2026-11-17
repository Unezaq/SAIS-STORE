'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { updateOrderStatusAction } from '@/actions/admin'

const STATUS_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  confirmee: 'Confirmée',
  expediee: 'Expédiée',
  livree: 'Livrée',
  annulee: 'Annulée',
}

export function OrderStatusSelect({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState(currentStatus)
  const router = useRouter()
  const { success, error: showError } = useToast()

  async function handleStatusChange(formData: FormData) {
    setPending(true)
    try {
      const result = await updateOrderStatusAction(formData)
      if (!result.ok) {
        setStatus(currentStatus)
        showError('Échec de la mise à jour', result.error)
        return
      }
      success('Statut mis à jour', 'Le client verra le nouveau statut sur sa page de suivi.')
      router.refresh()
    } catch {
      setStatus(currentStatus)
      showError('Échec de la mise à jour', 'Réessayez plus tard.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex items-center gap-2" aria-busy={pending}>
      <form action={handleStatusChange}>
        <input type="hidden" name="id" value={orderId} />
        <select
          name="status"
          value={status}
          onChange={(event) => {
            setStatus(event.currentTarget.value)
            event.currentTarget.form?.requestSubmit()
          }}
          className={`rounded-lg border border-hairline bg-white px-2 py-1.5 text-xs ${pending ? 'opacity-60' : ''}`}
          disabled={pending}
        >
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </form>
      {pending && <span role="status" className="text-xs text-text-muted">Mise à jour…</span>}
    </div>
  )
}
