'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { updateCustomerProfileAction } from '@/actions/customer-profile'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { CustomerSession } from '@/lib/auth/current-customer'

export function ProfileForm({ customer }: { customer: CustomerSession }) {
  const { success, error: showError } = useToast()
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)

    try {
      const formData = new FormData(event.currentTarget)
      const result = await updateCustomerProfileAction(formData)
      if (result.ok) {
        success('Profil mis à jour', 'Vos informations ont été enregistrées.')
      } else {
        showError('Impossible de modifier le profil', result.error)
      }
    } catch {
      showError('Impossible de modifier le profil', 'Vérifiez votre connexion et réessayez.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="rounded-[24px] bg-white p-fib-4 shadow-sm ring-1 ring-hairline">
      <h2 className="text-heading text-ink mb-fib-3">Modifier mes coordonnées</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-fib-2">
        <Input
          label="Nom complet"
          name="fullName"
          autoComplete="name"
          defaultValue={customer.full_name}
          required
        />
        <Input
          label="Ville"
          name="city"
          autoComplete="address-level2"
          defaultValue={customer.city}
          required
        />
        <Input
          label="Adresse complète"
          name="address"
          autoComplete="street-address"
          defaultValue={customer.address}
          required
        />
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={customer.email ?? ''}
        />
        <Input
          label="Téléphone"
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={customer.phone}
          required
        />
        <Button
          type="submit"
          size="lg"
          className="w-full"
          isLoading={pending}
          disabled={pending}
        >
          {pending ? 'Enregistrement…' : 'Enregistrer mes coordonnées'}
        </Button>
      </form>
    </section>
  )
}
