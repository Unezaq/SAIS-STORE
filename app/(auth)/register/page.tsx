'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { registerCustomerAction } from '@/actions/customer-auth'

export default function RegisterPage() {
  const router = useRouter()
  const { success, error: showError } = useToast()
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    try {
      const formData = new FormData(e.currentTarget)
      const result = await registerCustomerAction(formData)
      if (result.ok) {
        success('Compte créé', "Bienvenue chez SAIS ! Vous êtes connecté.")
        router.push('/account')
        return
      }
      showError("Échec de l'inscription", result.error)
    } catch {
      showError("Échec de l'inscription", 'Vérifiez votre connexion et réessayez.')
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
          Créez votre espace client pour retrouver vos informations et suivre vos commandes.
        </p>
        <form onSubmit={handleSubmit} className="mt-fib-3 flex flex-col gap-fib-2">
          <Input
            label="Nom complet"
            name="fullName"
            autoComplete="name"
            placeholder="Prénom Nom"
            required
            autoFocus
          />
          <Input
            label="Ville"
            name="city"
            autoComplete="address-level2"
            placeholder="Kenitra"
            required
          />
          <Input
            label="Adresse complète"
            name="address"
            autoComplete="street-address"
            placeholder="Rue, quartier, code postal"
            required
          />
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="vous@exemple.ma"
            required
          />
          <Input
            label="Téléphone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="06 12 34 56 78"
            helperText="C'est avec ce numéro que vous vous connecterez."
            required
          />
          <Input
            label="Mot de passe"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            helperText="Au moins 8 caractères, une majuscule, une minuscule et un chiffre."
            required
          />
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
