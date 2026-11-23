'use client'

import * as React from 'react'
import {
  updateCustomerProfile,
  changePasswordAction,
  getCustomerProfile,
  addCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultAddress,
  getCustomerAddresses,
  getCustomerOrders,
  logoutAccountAction,
  type CustomerProfile,
  type CustomerAddress,
} from '@/actions/customer-account'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { OrderStatusBadge } from '@/components/storefront/OrderStatusBadge'
import type { OrderStatus } from '@/lib/orderStatus'
import { formatMoroccanPhone } from '@/lib/phone'
import { formatMAD } from '@/lib/utils'
import Link from 'next/link'
import {
  User,
  MapPin,
  Mail,
  Lock,
  Truck,
  Plus,
  Edit2,
  Trash2,
  Check,
  ChevronRight,
  LogOut,
  AlertCircle,
  X,
  ShoppingBag,
  Clock,
  Home,
} from 'lucide-react'

type Tab = 'infos' | 'adresses' | 'commandes'

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: 'infos', label: 'Infos', icon: User },
  { id: 'adresses', label: 'Adresses', icon: MapPin },
  { id: 'commandes', label: 'Commandes', icon: ShoppingBag },
]

export default function CustomerProfile({ initialTab = 'infos' }: { initialTab?: Tab }) {
  const [tab, setTab] = React.useState<Tab>(initialTab)
  const [profile, setProfile] = React.useState<CustomerProfile | null>(null)
  const [addresses, setAddresses] = React.useState<CustomerAddress[]>([])
  const [orderList, setOrderList] = React.useState<Array<{
    id: string
    orderNumber: string
    trackingToken: string | undefined
    status: OrderStatus
    total: number
    deliveryFee: number
    createdAt: string
    address: string
    phone: string
    items: Array<{
      slug: string
      title: string
      color?: string
      size?: string
      quantity: number
      price: number
    }>
  }>>([])
  const [loading, setLoading] = React.useState(true)
  const [editingAddressId, setEditingAddressId] = React.useState<string | null>(null)
  const [showAddAddress, setShowAddAddress] = React.useState(false)
  const [showChangePassword, setShowChangePassword] = React.useState(false)
  const { show: showToast } = useToast()

  React.useEffect(() => {
    load()
  }, [])

  // Must stay above the `if (loading)` early return: hooks need to run in the
  // same order on every render (Rules of Hooks).
  const editingAddress = React.useMemo(
    () => addresses.find((a) => a.id === editingAddressId) ?? null,
    [addresses, editingAddressId]
  )

  async function load() {
    setLoading(true)
    try {
      const [profileRes, addressesRes, ordersRes] = await Promise.all([
        getCustomerProfile(),
        getCustomerAddresses(),
        getCustomerOrders(),
      ])
      setProfile(profileRes ?? null)
      setAddresses(addressesRes)
      setOrderList((ordersRes ?? []).map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber ?? `SAIS-${o.id.slice(-8)}`,
        trackingToken: o.trackingToken,
        status: o.status,
        total: o.total,
        deliveryFee: o.deliveryFee,
        createdAt: o.createdAt,
        address: o.address,
        phone: o.phone,
        items: o.items,
      })))
    } catch {
      showToast('error', 'Impossible de charger vos informations. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  /* --------------------------------------------------------------- INFOS */
  async function handleProfileUpdate(event: React.FormEvent) {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    const formData = new FormData(form)
    const result = await updateCustomerProfile(formData)
    if (result.ok) {
      showToast('success', 'Profil mis à jour')
      await load()
    } else {
      showToast('error', result.error)
    }
  }

  async function handleChangePassword(event: React.FormEvent) {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    const formData = new FormData(form)
    const result = await changePasswordAction(formData)
    if (result.ok) {
      showToast('success', 'Mot de passe modifié')
      setShowChangePassword(false)
      form.reset()
    } else {
      showToast('error', result.error)
    }
  }

  /* ---------------------------------------------------------- ADDRESSES */
  async function handleAddAddress(event: React.FormEvent) {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    const formData = new FormData(form)
    const result = await addCustomerAddress(formData)
    if (result.ok) {
      showToast('success', 'Adresse ajoutée')
      setShowAddAddress(false)
      await load()
    } else {
      showToast('error', result.error)
    }
  }

  async function handleUpdateAddress(event: React.FormEvent) {
    event.preventDefault()
    if (!editingAddressId) return
    const form = event.currentTarget as HTMLFormElement
    const formData = new FormData(form)
    formData.set('id', editingAddressId)
    const result = await updateCustomerAddress(formData)
    if (result.ok) {
      showToast('success', 'Adresse modifiée')
      setEditingAddressId(null)
      await load()
    } else {
      showToast('error', result.error)
    }
  }

  async function handleSetDefault(id: string) {
    const formData = new FormData()
    formData.set('id', id)
    const result = await setDefaultAddress(formData)
    if (result.ok) {
      showToast('success', 'Adresse par défaut mise à jour')
      await load()
    } else {
      showToast('error', result.error)
    }
  }

  async function handleDeleteAddress(id: string) {
    if (!window.confirm('Supprimer cette adresse ?')) return
    const formData = new FormData()
    formData.set('id', id)
    const result = await deleteCustomerAddress(formData)
    if (result.ok) {
      showToast('success', 'Adresse supprimée')
      await load()
    } else {
      showToast('error', result.error)
    }
  }

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-5xl px-4 py-6">
        <p className="text-eyebrow uppercase text-text-muted">Mon compte</p>
        <h1 className="mt-2 text-title text-ink">Mon profil</h1>
        <div className="mt-4 rounded-2xl bg-surface-soft p-8 text-center text-text-muted">
          Chargement…
        </div>
      </section>
    )
  }

  const isProfileComplete =
    Boolean(profile?.fullName) && Boolean(profile?.phone)

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-fib-3 sm:py-fib-6">
      <p className="text-eyebrow uppercase text-text-muted">Mon compte</p>
      <h1 className="mt-2 text-title text-ink">Mon profil</h1>

      {!isProfileComplete && (
        <div
          className="mt-4 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100"
        >
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-700" />
            <div>
              <p className="text-sm font-medium text-ink">
                Complétez votre profil avant de commander
              </p>
              <p className="mt-0.5 text-sm text-text-muted">
                Votre nom, votre prénom et votre numéro de téléphone sont
                nécessaires pour enregistrer une commande.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs — scrollable on mobile, centered on desktop */}
      <div className="mt-4 rounded-full bg-surface-soft p-1 overflow-x-auto scrollbar-hide">
        <div className="flex flex-nowrap gap-1 min-w-max">
          {TABS.map((t) => {
            const active = tab === t.id
            const Icon = t.icon
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-pressed={active}
                className={`press shrink-0 rounded-full px-5 py-2.5 text-[13px] font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-primary text-white'
                    : 'text-text-muted hover:text-ink'
                }`}
              >
                <Icon size={15} className="mr-2" />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ---------- Informations personnelles ---------- */}
      {tab === 'infos' && (
        <section className="mt-4 space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-hairline sm:p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
              <User size={20} />
            </span>
            <h2 className="text-heading text-ink mb-3">Informations personnelles</h2>
            <form
              onSubmit={handleProfileUpdate}
              className="space-y-3"
            >
              <Input
                label="Prénom et nom"
                name="fullName"
                type="text"
                autoComplete="name"
                required
                minLength={2}
                maxLength={80}
                defaultValue={profile?.fullName ?? ''}
                className="w-full"
              />
              <Input
                label="Téléphone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="06 12 34 56 78"
                required
                defaultValue={profile?.phone ? profile.phone.replace(/^\+212/, '0') : ''}
                className="w-full"
              />
              <div className="flex items-center justify-between gap-4 py-3 border-t border-hairline">
                <span className="text-text-muted">Email</span>
                <span className="font-medium text-ink" dir="ltr">
                  {profile?.email ?? '—'}
                </span>
              </div>
              <Button type="submit" size="lg" className="w-full">
                Enregistrer les modifications
              </Button>
            </form>

            <div className="mt-4 rounded-2xl border border-hairline p-4">
              <h3 className="text-[13px] font-semibold text-ink mb-3">
                Changer le mot de passe
              </h3>
              <button
                type="button"
                onClick={() => setShowChangePassword(true)}
                className="press w-full inline-flex items-center justify-center gap-2 rounded-xl border border-hairline px-3 py-3 text-sm font-medium text-ink hover:bg-surface-soft"
              >
                <Lock size={15} /> Modifier le mot de passe
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-hairline sm:p-6 flex flex-col">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
              <Mail size={20} />
            </span>
            <h2 className="text-heading text-ink mb-3">Votre compte</h2>
            <dl className="divide-y divide-hairline text-sm space-y-0">
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-text-muted">Statut</dt>
                <dd className="text-end font-medium text-ink">Connecté(e)</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-text-muted">Email</dt>
                <dd className="text-end font-medium text-ink" dir="ltr">
                  {profile?.email ?? '—'}
                </dd>
              </div>
              {profile?.phone && (
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-text-muted">Téléphone</dt>
                  <dd className="text-end font-medium text-ink" dir="ltr">
                    {formatMoroccanPhone(profile.phone)}
                  </dd>
                </div>
              )}
            </dl>

            <form action={logoutAccountAction} className="mt-4">
              <button
                type="submit"
                className="press w-full inline-flex items-center justify-center gap-2 rounded-full border border-hairline px-6 text-sm font-medium text-text-muted hover:bg-surface-soft"
              >
                <LogOut size={15} /> Se déconnecter
              </button>
            </form>
          </div>
        </section>
      )}

      {/* ---------- Mes adresses ---------- */}
      {tab === 'adresses' && (
        <section className="mt-4 space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-hairline sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-heading text-ink">Mes adresses</h2>
              <button
                type="button"
                onClick={() => setShowAddAddress(true)}
                className="press inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary-light sm:px-5 sm:py-2.5 sm:text-sm"
              >
                <Plus size={14} /> Ajouter
              </button>
            </div>

            <p className="text-sm text-text-muted mb-4">
              Enregistrez plusieurs adresses de livraison. Choisissez-en une
              par défaut pour qu’elle soit pré-remplie à la commande.
            </p>

            {addresses.length === 0 && (
              <div className="rounded-2xl bg-surface-soft p-8 sm:p-12 text-center text-text-muted">
                <MapPin size={28} className="mx-auto mb-3 opacity-40" />
                <p>Aucune adresse enregistrée pour le moment.</p>
              </div>
            )}

            <ul className="divide-y divide-hairline rounded-2xl bg-white">
              {addresses.map((addr) => (
                <li
                  key={addr.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] font-medium text-text-muted uppercase tracking-[0.12em]">
                        {addr.label}
                      </span>
                      {addr.isDefault && (
                        <Badge variant="success" size="sm">
                          Par défaut <Check size={11} strokeWidth={2} />
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-ink leading-tight">
                      {addr.firstName} {addr.lastName}
                    </p>
                    <p className="mt-1 text-sm text-text-muted" dir="ltr">
                      {formatMoroccanPhone(addr.phone)}
                    </p>
                    <p className="mt-1 text-sm text-text-muted">
                      {addr.address}, {addr.city}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    {!addr.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(addr.id)}
                        className="press shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-hairline px-3 py-2 text-xs font-medium text-ink hover:bg-surface-soft sm:text-sm sm:px-4 sm:py-2.5"
                      >
                        <Check size={12} strokeWidth={2} />
                        Par défaut
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingAddressId(addr.id)}
                      className="press shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-hairline px-3 py-2 text-xs font-medium text-ink hover:bg-surface-soft sm:text-sm sm:px-4 sm:py-2.5"
                    >
                      <Edit2 size={12} strokeWidth={2} />
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(addr.id)}
                      className="press shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-hairline px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-100 sm:text-sm sm:px-4 sm:py-2.5"
                    >
                      <Trash2 size={12} strokeWidth={2} />
                      Supprimer
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {/* Edit address form */}
            {editingAddressId && (
              <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-hairline sm:p-6">
                <h3 className="text-heading text-ink mb-3">Modifier l’adresse</h3>
                <form
                  onSubmit={handleUpdateAddress}
                  className="space-y-3"
                >
                  <Input
                    label="Libellé"
                    name="label"
                    placeholder="Ex. Domicile"
                    defaultValue={editingAddress?.label ?? ''}
                    className="w-full"
                  />
                  <Input
                    label="Prénom"
                    name="firstName"
                    defaultValue={editingAddress?.firstName ?? ''}
                    className="w-full"
                  />
                  <Input
                    label="Nom"
                    name="lastName"
                    defaultValue={editingAddress?.lastName ?? ''}
                    className="w-full"
                  />
                  <Input
                    label="Téléphone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="06 12 34 56 78"
                    defaultValue={
                      editingAddress?.phone.replace(/^\+212/, '0') ?? ''
                    }
                    className="w-full"
                  />
                  <Input
                    label="Ville"
                    name="city"
                    placeholder="Kenitra"
                    defaultValue={editingAddress?.city ?? ''}
                    className="w-full"
                  />
                  <label className="flex flex-col gap-1.5">
                    <span className="text-eyebrow uppercase text-text-muted">
                      Adresse complète
                    </span>
                    <textarea
                      name="address"
                      defaultValue={editingAddress?.address ?? ''}
                      aria-label="Adresse complète"
                      className="w-full bg-surface text-ink text-sm rounded-2xl border border-ink/10 px-3 py-3 placeholder:text-text-muted/60 transition-colors focus:outline-none focus:border-ink/30 focus:ring-4 focus:ring-ink/[0.06] sm:px-4 sm:py-3"
                      rows={3}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      name="isDefault"
                      defaultChecked={Boolean(editingAddress?.isDefault)}
                      className="h-4 w-4 shrink-0 accent-[var(--color-primary)]"
                    />
                    Définir comme adresse par défaut
                  </label>
                  <div className="mt-1 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingAddressId(null)}
                      className="press rounded-full border border-hairline px-4 py-2 text-xs font-medium text-text-muted hover:bg-surface-soft sm:px-5 sm:py-2.5 sm:text-sm"
                    >
                      Annuler
                    </button>
                    <Button type="submit" size="sm" className="w-full sm:w-auto">
                      Enregistrer
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* Add address form */}
            {showAddAddress && (
              <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-hairline sm:p-6">
                <h3 className="text-heading text-ink mb-3">Nouvelle adresse</h3>
                <form
                  onSubmit={handleAddAddress}
                  className="space-y-3"
                >
                  <Input
                    label="Libellé"
                    name="label"
                    placeholder="Ex. Domicile"
                    defaultValue="Adresse"
                    className="w-full"
                  />
                  <Input
                    label="Prénom"
                    name="firstName"
                    defaultValue={profile?.fullName?.split(' ')[0] ?? ''}
                    className="w-full"
                  />
                  <Input
                    label="Nom"
                    name="lastName"
                    defaultValue={profile?.fullName?.split(' ').slice(1).join(' ') ?? ''}
                    className="w-full"
                  />
                  <Input
                    label="Téléphone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="06 12 34 56 78"
                    defaultValue={
                      profile?.phone ? profile.phone.replace(/^\+212/, '0') : ''
                    }
                    className="w-full"
                  />
                  <Input
                    label="Ville"
                    name="city"
                    placeholder="Kenitra"
                    defaultValue="Casablanca"
                    className="w-full"
                  />
                  <label className="flex flex-col gap-1.5">
                    <span className="text-eyebrow uppercase text-text-muted">
                      Adresse complète
                    </span>
                    <textarea
                      name="address"
                      aria-label="Adresse complète"
                      className="w-full bg-surface text-ink text-sm rounded-2xl border border-ink/10 px-3 py-3 placeholder:text-text-muted/60 transition-colors focus:outline-none focus:border-ink/30 focus:ring-4 focus:ring-ink/[0.06] sm:px-4 sm:py-3"
                      rows={3}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      name="isDefault"
                      defaultChecked={addresses.length === 0}
                      className="h-4 w-4 shrink-0 accent-[var(--color-primary)]"
                    />
                    Définir comme adresse par défaut
                  </label>
                  <div className="mt-1 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddAddress(false)}
                      className="press rounded-full border border-hairline px-4 py-2 text-xs font-medium text-text-muted hover:bg-surface-soft sm:px-5 sm:py-2.5 sm:text-sm"
                    >
                      Annuler
                    </button>
                    <Button type="submit" size="sm" className="w-full sm:w-auto">
                      Ajouter l’adresse
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---------- Mes commandes ---------- */}
      {tab === 'commandes' && (
        <section className="mt-4 space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-hairline sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-heading text-ink mb-1">Mes commandes</h2>
                <p className="text-sm text-text-muted">
                  Suivez l’avancement de vos commandes, de la confirmation à la
                  livraison.
                </p>
              </div>
              {orderList.length > 0 && (
                <Link
                  href="/boutique"
                  className="press inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-soft sm:text-sm sm:px-4 sm:py-2"
                >
                  <Home size={14} /> Nouvelle commande
                </Link>
              )}
            </div>

            {orderList.length === 0 ? (
              <div className="rounded-2xl bg-surface-soft p-8 sm:p-12 text-center text-text-muted">
                <Truck size={32} className="mx-auto mb-3 opacity-40" />
                <p>Aucune commande pour le moment.</p>
                <p className="mt-1 text-xs">
                  Passez votre première commande depuis la boutique.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {orderList.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Change password sheet */}
      {showChangePassword && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowChangePassword(false)}
          />
          <div className="relative w-full max-w-md mx-auto p-4 sm:p-6 rounded-t-3xl bg-white shadow-2xl ring-1 ring-hairline">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-heading text-ink">Changer le mot de passe</h2>
              <button
                type="button"
                onClick={() => setShowChangePassword(false)}
                className="rounded-full p-2 text-text-muted hover:bg-surface-soft"
                aria-label="Fermer"
              >
                <span className="sr-only">Fermer</span>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <Input
                label="Mot de passe actuel"
                name="currentPassword"
                type="password"
                required
                minLength={1}
                className="w-full"
              />
              <Input
                label="Nouveau mot de passe"
                name="newPassword"
                type="password"
                required
                minLength={8}
                maxLength={72}
                className="w-full"
              />
              <Button type="submit" size="lg" className="w-full">
                Confirmer le changement
              </Button>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

/* --------------------------------------------------------------- ORDER CARD */
interface OrderCardProps {
  order: {
    id: string
    orderNumber: string
    trackingToken: string | undefined
    status: OrderStatus
    total: number
    deliveryFee: number
    createdAt: string
    address: string
    phone: string
    items: Array<{
      slug: string
      title: string
      color?: string
      size?: string
      quantity: number
      price: number
    }>
  }
}

function OrderCard({ order }: OrderCardProps) {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <article className="rounded-2xl bg-white border border-hairline p-4 flex flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-ink tracking-wide">
          {order.orderNumber}
        </span>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="mb-3 flex items-center gap-2 text-xs text-text-muted">
        <Clock size={14} />
        <span>
          {new Date(order.createdAt).toLocaleDateString('fr-MA', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })}
        </span>
        <span className="h-3 w-px bg-hairline mx-2" aria-hidden />
        <span>{itemCount} article{itemCount > 1 ? 's' : ''}</span>
      </div>

      {/* Articles de la commande */}
      <ul className="space-y-2 mb-3">
        {order.items.map((item, index) => {
          const variant = [item.color, item.size].filter(Boolean).join(' / ')
          return (
            <li
              key={`${item.slug}-${index}`}
              className="flex items-start gap-2 text-sm"
            >
              <span className="shrink-0 text-text-muted">{item.quantity}×</span>
              <div className="min-w-0 flex-1">
                <p className="text-ink leading-tight truncate">{item.title}</p>
                {variant && (
                  <p className="text-[11px] text-text-muted truncate">{variant}</p>
                )}
              </div>
              <span className="shrink-0 font-medium text-ink text-right">
                {formatMAD(item.price * item.quantity)}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="mt-auto pt-3 border-t border-hairline flex items-center justify-between gap-3">
        <div className="text-sm text-text-muted">
          <span className="font-medium text-ink">{formatMAD(order.total)}</span>
          {order.deliveryFee > 0 && (
            <>
              <span className="ml-1"> + </span>
              <span className="text-xs">{formatMAD(order.deliveryFee)} livraison</span>
            </>
          )}
        </div>
        <Link
          href={
            order.trackingToken
              ? `/suivre/${order.trackingToken}`
              : `/suivre/${order.id}`
          }
          className="press inline-flex items-center gap-1.5 rounded-xl border border-hairline px-3 py-1.5 text-[11px] font-medium text-ink hover:bg-surface-soft sm:px-4 sm:py-2"
        >
          Suivi <ChevronRight size={13} />
        </Link>
      </div>

      <p className="mt-2 text-[11px] text-text-muted truncate">
        {order.address}
      </p>
    </article>
  )
}
