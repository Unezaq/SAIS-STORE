import Link from 'next/link'
import { Plus, Pencil, Trash2, ToggleRight, ToggleLeft } from 'lucide-react'
import { deleteCouponActionAdmin, toggleCouponActionAdmin } from '@/actions/admin'
import { getCoupons } from '@/lib/products'
import { formatMAD } from '@/lib/utils'

export default async function AdminCouponsPage() {
  const coupons = await getCoupons()

  return (
    <div className="flex flex-col gap-fib-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow uppercase text-text-muted">Promotions</p>
          <h1 className="mt-fib-1 text-title text-ink">Codes de réduction</h1>
          <p className="mt-fib-1 text-sm text-text-muted">
            Gérez les codes promo applicables en caisse (pourcentage ou montant fixe).
          </p>
        </div>
        <Link
          href="/admin/coupons/new"
          className="press inline-flex items-center gap-2 rounded-full bg-ink px-fib-3 py-fib-1 text-sm font-medium text-white hover:bg-ink/90"
        >
          <Plus size={16} /> Nouveau code
        </Link>
      </div>

      {coupons.length === 0 ? (
        <div className="rounded-[20px] bg-white p-fib-4 text-center text-text-muted shadow-sm ring-1 ring-hairline">
          Aucun code de réduction pour le moment.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-hairline">
          <table className="w-full text-sm">
            <thead className="bg-surface-soft text-left text-[11px] uppercase tracking-[0.12em] text-text-muted">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Valeur</th>
                <th className="px-4 py-3">Minimum</th>
                <th className="px-4 py-3">Utilisations</th>
                <th className="px-4 py-3">Expiration</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-end">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {coupons.map((c) => (
                <tr key={c.id} className="hover:bg-surface-soft/60">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">
                    {c.code.toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {c.type === 'percentage' ? 'Pourcentage' : 'Montant fixe'}
                  </td>
                  <td className="px-4 py-3 tabular text-ink">
                    {c.type === 'percentage' ? `-${c.value}%` : `- ${formatMAD(c.value)}`}
                  </td>
                  <td className="px-4 py-3 tabular text-text-muted">
                    {c.minOrder > 0 ? formatMAD(c.minOrder) : 'Aucun'}
                  </td>
                  <td className="px-4 py-3 tabular text-text-muted">
                    {c.maxUses ? `${c.usedCount} / ${c.maxUses}` : c.usedCount}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('fr-MA') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <form
                      action={async (formData: FormData) => {
                        await toggleCouponActionAdmin(formData)
                      }}
                    >
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="isActive" value={String(!c.isActive)} />
                      <button
                        type="submit"
                        className={`press inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                          c.isActive
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        {c.isActive ? (
                          <span className="flex items-center gap-1.5">
                            <ToggleRight size={12} />
                            Actif
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <ToggleLeft size={12} />
                            Inactif
                          </span>
                        )}
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/coupons/${c.id}`}
                        className="press flex h-8 w-8 items-center justify-center rounded-full text-ink/70 hover:bg-ink/[0.06] hover:text-ink"
                        aria-label="Modifier"
                      >
                        <Pencil size={15} />
                      </Link>
                      <form
                        action={async (formData: FormData) => {
                          await deleteCouponActionAdmin(formData)
                        }}
                      >
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          className="press flex h-8 w-8 items-center justify-center rounded-full text-rose-600 hover:bg-rose-50"
                          aria-label="Supprimer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
