'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateCustomerProfileAction } from '@/actions/customer-profile'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import type { StoreClient } from '@/lib/types/store'

type AccountProfile = Pick<StoreClient, 'firstName' | 'lastName' | 'phone' | 'address'>

export function AccountProfileForm({ profile }: { profile: AccountProfile }) {
  const router = useRouter()
  const { success, error: showError } = useToast()
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)

    try {
      const result = await updateCustomerProfileAction(new FormData(event.currentTarget))
      if (!result.ok) {
        showError('Impossible de modifier le profil', result.error)
        return
      }

      success('Informations enregistrées', 'Ces coordonnées seront proposées lors de la prochaine commande.')
      router.refresh()
    } catch {
      showError('Impossible de modifier le profil', 'Vérifiez votre connexion et réessayez.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="mb-fib-4 rounded-[24px] bg-white p-fib-4 shadow-sm ring-1 ring-hairline">
      <h2 className="text-heading text-ink">Mes coordonnées de livraison</h2>
      <p className="mt-1 text-sm text-text-muted">
        Modifiez vos informations enregistrées. Les anciennes commandes garderont leur adresse d'origine.
      </p>
      <form onSubmit={handleSubmit} className="mt-fib-3 grid gap-fib-2 sm:grid-cols-2">
        <Input
          label="Prénom"
          name="firstName"
          autoComplete="given-name"
          defaultValue={profile.firstName}
          required
        />
        <Input
          label="Nom de famille"
          name="lastName"
          autoComplete="family-name"
          defaultValue={profile.lastName}
          required
        />
        <Input
          label="Téléphone"
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={profile.phone}
          required
        />
        <label className="w-full flex flex-col gap-1.5 text-start text-eyebrow uppercase text-text-muted sm:col-span-2">
          Adresse de livraison
          <textarea
            name="address"
            autoComplete="street-address"
            defaultValue={profile.address ?? ''}
            required
            maxLength={500}
            rows={3}
            className="w-full rounded-2xl border border-ink/10 bg-surface px-4 py-3 text-sm text-ink outline-none transition focus:border-ink/30 focus:ring-4 focus:ring-ink/[0.06]"
          />
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" isLoading={pending} disabled={pending}>
            {pending ? 'Enregistrement…' : 'Enregistrer mes coordonnées'}
          </Button>
        </div>
      </form>
    </section>
  )
}
