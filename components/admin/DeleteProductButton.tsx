'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { deleteProductAction } from '@/actions/admin'

export function DeleteProductButton({ slug }: { slug: string }) {
  const [pending, setPending] = useState(false)
  const { success, error: showError } = useToast()

  async function handleDelete(formData: FormData) {
    setPending(true)
    try {
      const result = await deleteProductAction(formData)
      if (!result.ok) {
        showError('Échec de la suppression', result.error)
        return
      }
      success('Produit supprimé', 'La pièce a été retirée du catalogue.')
    } catch {
      showError('Échec de la suppression', 'Réessayez plus tard.')
    } finally {
      setPending(false)
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
        aria-label={pending ? 'Suppression…' : 'Supprimer'}
      >
        <Trash2 size={14} />
      </Button>
    </form>
  )
}
