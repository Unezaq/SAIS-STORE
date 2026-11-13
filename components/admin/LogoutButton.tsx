'use client'

import { useFormStatus } from 'react-dom'
import { LogOut } from 'lucide-react'
import { logoutAction } from '@/actions/admin'

function LogoutSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-soft hover:text-ink disabled:opacity-50"
    >
      {pending ? (
        <span
          aria-hidden="true"
          className="h-[17px] w-[17px] animate-spin rounded-full border-2 border-current/30 border-t-current"
        />
      ) : (
        <LogOut size={17} strokeWidth={1.8} />
      )}
      {pending ? 'Déconnexion…' : 'Déconnexion'}
    </button>
  )
}

export function LogoutButton() {
  return (
    <form action={logoutAction} className="border-t border-hairline p-3">
      <LogoutSubmitButton />
    </form>
  )
}
