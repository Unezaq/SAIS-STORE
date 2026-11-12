'use client'

import { useFormStatus } from 'react-dom'
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
  const { pending } = useFormStatus()
  const { success, error: showError } = useToast()

  async function handleStatusChange(formData: FormData) {
    try {
      await updateOrderStatusAction(formData)
      success('Statut mis à jour', 'Le client sera informé par WhatsApp.')
    } catch {
      showError('Échec de la mise à jour', 'Réessayez plus tard.')
    }
  }

  return (
    <form action={handleStatusChange}>
      <input type="hidden" name="id" value={orderId} />
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={`rounded-lg border border-hairline bg-white px-2 py-1.5 text-xs ${pending ? 'opacity-60' : ''}`}
        disabled={pending}
      >
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    </form>
  )
}
