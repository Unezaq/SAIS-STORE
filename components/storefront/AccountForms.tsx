'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { loginAccountAction, registerAccountAction } from '@/actions/customer-account'

type Mode = 'inscription' | 'connexion'

export function AccountForms({ initialMode = 'inscription' }: { initialMode?: Mode }) {
  const router = useRouter()
  const [mode, setMode] = React.useState<Mode>(initialMode)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
  }

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const result = await registerAccountAction(new FormData(event.currentTarget))
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    } catch {
      setError('Connexion impossible. Vérifiez votre réseau et réessayez.')
    } finally {
      setPending(false)
    }
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const result = await loginAccountAction(new FormData(event.currentTarget))
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    } catch {
      setError('Connexion impossible. Vérifiez votre réseau et réessayez.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-[24px] bg-white p-6 shadow-sm ring-1 ring-hairline md:p-8">
      <div className="flex rounded-full bg-surface-soft p-1">
        <button
          type="button"
          onClick={() => switchMode('inscription')}
          aria-pressed={mode === 'inscription'}
          className={`press flex-1 rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${
            mode === 'inscription' ? 'bg-primary text-white' : 'text-text-muted hover:text-ink'
          }`}
        >
          Créer un compte
        </button>
        <button
          type="button"
          onClick={() => switchMode('connexion')}
          aria-pressed={mode === 'connexion'}
          className={`press flex-1 rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${
            mode === 'connexion' ? 'bg-primary text-white' : 'text-text-muted hover:text-ink'
          }`}
        >
          Se connecter
        </button>
      </div>

      {mode === 'inscription' ? (
        <form onSubmit={handleRegister} aria-busy={pending} className="mt-fib-3 flex flex-col gap-fib-2">
          <Input
            label="Nom complet"
            name="fullName"
            type="text"
            placeholder="Ex. Salma El Amrani"
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
          />
          <Input
            label="Email"
            name="email"
            type="email"
            placeholder="vous@exemple.ma"
            autoComplete="email"
            required
          />
          <Input
            label="Téléphone (optionnel)"
            name="phone"
            type="tel"
            placeholder="06 12 34 56 78"
            autoComplete="tel"
            inputMode="tel"
            helperText="Utile pour retrouver vos commandes plus vite."
          />
          <Input
            label="Mot de passe"
            name="password"
            type="password"
            placeholder="8 caractères minimum"
            autoComplete="new-password"
            required
            minLength={8}
          />
          <p className="text-xs leading-relaxed text-text-muted">
            En créant un compte, vous acceptez de recevoir nos offres réservées aux clientes
            fidèles. Vous pouvez commander sans compte à tout moment.
          </p>
          <Button type="submit" size="lg" className="w-full" isLoading={pending} disabled={pending}>
            {pending ? 'Création…' : 'Créer mon compte'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleLogin} aria-busy={pending} className="mt-fib-3 flex flex-col gap-fib-2">
          <Input
            label="Email"
            name="email"
            type="email"
            placeholder="vous@exemple.ma"
            autoComplete="email"
            required
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
      )}

      {error && (
        <p
          role="alert"
          className="mt-fib-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm leading-relaxed text-rose-700 ring-1 ring-rose-100"
        >
          {error}
        </p>
      )}
    </div>
  )
}
