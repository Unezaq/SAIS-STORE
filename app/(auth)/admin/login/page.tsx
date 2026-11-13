'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { loginAction } from '@/actions/admin'

export default function AdminLoginPage() {
  const router = useRouter()
  const { success, error: showError } = useToast()
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    try {
      const formData = new FormData(e.currentTarget)
      const result = await loginAction(formData)
      if (result?.ok) {
        success('Connexion réussie', 'Bienvenue dans ladmin SAIS.')
        router.push('/admin')
        return
      }
      showError("Échec de la connexion", result?.error ?? 'Mot de passe incorrect.')
    } catch {
      showError("Échec de la connexion", 'Vérifiez votre connexion et réessayez.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-soft p-6">
      <div className="w-full max-w-sm rounded-[24px] bg-white p-fib-4 shadow-[0_16px_40px_-12px_rgba(16,32,26,0.15)]">
        <p className="text-eyebrow uppercase text-text-muted">SAIS Store</p>
        <h1 className="mt-fib-1 text-title text-ink">Connexion admin</h1>
        <p className="mt-fib-1 text-sm text-text-muted">
          Connectez-vous avec votre compte administrateur.
        </p>
        <form onSubmit={handleSubmit} className="mt-fib-3 flex flex-col gap-fib-2">
          <Input
            label="Email"
            name="email"
            type="email"
            placeholder="admin@votre-domaine.ma"
            required
            autoFocus
          />
          <Input
            label="Mot de passe"
            name="password"
            type="password"
            placeholder="••••••••"
            required
          />
          <Button type="submit" size="lg" className="w-full" isLoading={pending} disabled={pending}>
            {pending ? 'Connexion…' : 'Se connecter'}
          </Button>
        </form>
      </div>
    </div>
  )
}
