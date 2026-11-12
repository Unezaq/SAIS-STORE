'use client'

import { useFormStatus } from 'react-dom'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { deleteProductAction } from '@/actions/admin'

export function DeleteProductButton({ slug }: { slug: string }) {
  const { pending } = useFormStatus()
  const { success, error: showError } = useToast()

  async function handleDelete(formData: FormData) {
    try {
      await deleteProductAction(formData)
      success('Produit supprimé', 'La pièce a été retirée du catalogue.')
    } catch {
      showError('Échec de la suppression', 'Réessayez plus tard.')
    }
  }

  return (
    <form action={handleDelete}>
      <input type="hidden" name="slug" value={slug} />
      <Button
        type="submit"
        size="sm"
        variant="danger"
        disabled={pending}
        isLoading={pending}
        aria-label="Supprimer"
      >
        <Trash2 size={14} />
      </Button>
    </form>
  )
}
