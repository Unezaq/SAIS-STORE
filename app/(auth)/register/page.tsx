'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { registerClientAction } from '@/actions/client'

export default function ClientRegisterPage() {
  const router = useRouter()
  const { success, error: showError } = useToast()
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    try {
      const formData = new FormData(e.currentTarget)
      const result = await registerClientAction(formData)
      if (result?.ok) {
        if (result.requiresEmailConfirmation) {
          success('Compte créé', 'Consultez votre email pour confirmer votre adresse.')
          router.push('/login')
        } else {
          success('Compte créé', 'Bienvenue chez SAIS ! Vous êtes connecté.')
          router.push('/account')
        }
        return
      }
      showError('Échec de linscription', result?.error ?? 'Une erreur est survenue.')
    } catch {
      showError('Échec de linscription', 'Vérifiez votre connexion et réessayez.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-soft p-6">
      <div className="w-full max-w-sm rounded-[24px] bg-white p-fib-4 shadow-[0_16px_40px_-12px_rgba(16,32,26,0.15)]">
        <p className="text-eyebrow uppercase text-text-muted">SAIS Store</p>
        <h1 className="mt-fib-1 text-title text-ink">Créer votre compte</h1>
        <p className="mt-fib-1 text-sm text-text-muted">
          Vos informations sont sécurisées et servent pour vos commandes et livraisons.
        </p>
        <form onSubmit={handleSubmit} className="mt-fib-3 flex flex-col gap-fib-2">
          <Input label="Prénom" name="firstName" required autoFocus />
          <Input label="Nom de famille" name="lastName" required />
          <Input label="Email" name="email" type="email" required />
          <Input label="Téléphone" name="phone" placeholder="06 12 34 56 78" required />
          <Input label="Adresse de livraison" name="address" placeholder="Rue, ville, code postal" />
          <Input label="Mot de passe" name="password" type="password" minLength={8} required />
          <Button type="submit" size="lg" className="w-full" isLoading={pending} disabled={pending}>
            {pending ? 'Création…' : 'Créer le compte'}
          </Button>
        </form>
        <p className="mt-fib-3 text-center text-sm text-text-muted">
          Déjà un compte ?{' '}
          <Link href="/login" className="text-ink font-medium hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
