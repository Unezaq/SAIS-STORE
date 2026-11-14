'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { loginAction as clientLogin } from '@/actions/client'

export default function ClientLoginPage() {
  const router = useRouter()
  const { success, error: showError } = useToast()
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    try {
      const formData = new FormData(e.currentTarget)
      const result = await clientLogin(formData)
      if (result?.ok) {
        success(
          'Connexion réussie',
          result.isBootstrapAdmin
            ? 'Bienvenue dans votre espace administrateur.'
            : 'Bienvenue sur votre compte SAIS.'
        )
        router.push(result.isBootstrapAdmin ? '/admin' : '/account')
        return
      }
      showError('Échec de la connexion', result?.error ?? 'Email ou mot de passe incorrect.')
    } catch {
      showError('Échec de la connexion', 'Vérifiez votre connexion et réessayez.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-soft p-6">
      <div className="w-full max-w-sm rounded-[24px] bg-white p-fib-4 shadow-[0_16px_40px_-12px_rgba(16,32,26,0.15)]">
        <p className="text-eyebrow uppercase text-text-muted">SAIS Store</p>
        <h1 className="mt-fib-1 text-title text-ink">Connexion client</h1>
        <p className="mt-fib-1 text-sm text-text-muted">
          Accédez à votre compte et suivez vos commandes.
        </p>
        <form onSubmit={handleSubmit} className="mt-fib-3 flex flex-col gap-fib-2">
          <Input
            label="Email"
            name="email"
            type="email"
            placeholder="vous@email.com"
            autoComplete="email"
            required
            autoFocus
          />
          <Input
            label="Mot de passe"
            name="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
          <Button type="submit" size="lg" className="w-full" isLoading={pending} disabled={pending}>
            {pending ? 'Connexion…' : 'Se connecter'}
          </Button>
        </form>
        <p className="mt-fib-3 text-center text-sm text-text-muted">
          Pas encore de compte ?{' '}
          <Link href="/register" className="text-ink font-medium hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  )
}
