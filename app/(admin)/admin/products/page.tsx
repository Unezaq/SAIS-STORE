import Link from 'next/link'
import { Plus, Pencil } from 'lucide-react'
import { getProducts } from '@/lib/products'
import { DeleteProductButton } from '@/components/admin/DeleteProductButton'

export default async function AdminProductsPage() {
  const products = await getProducts()

  return (
    <div className="flex flex-col gap-fib-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow uppercase text-text-muted">Catalogue</p>
          <h1 className="mt-fib-1 text-title text-ink">Produits</h1>
          <p className="mt-fib-1 text-sm text-text-muted">{products.length} pièces au total.</p>
        </div>
        <Link
          href="/admin/products/new"
          className="press inline-flex items-center gap-2 rounded-full bg-ink px-fib-3 py-fib-1 text-sm font-medium text-white hover:bg-ink/90"
        >
          <Plus size={16} /> Nouveau produit
        </Link>
      </div>

      {/* Mobile: cards */}
      <div className="grid gap-3 md:hidden">
        {products.map((p) => (
          <div
            key={p.slug}
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-hairline flex items-start gap-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.imageUrl} alt="" className="h-14 w-14 rounded-lg object-cover shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink leading-tight">{p.title}</p>
              <p className="text-xs text-text-muted truncate">{p.slug}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
                <span>{p.categoryName}</span>
                <span>·</span>
                <span className="tabular font-medium text-ink">{p.price} MAD</span>
                {p.originalPrice && (
                  <span className="line-through text-text-muted">{p.originalPrice}</span>
                )}
              </div>
              {p.badge && (
                <span className="mt-1 inline-block rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10px] font-medium text-ink">
                  {p.badge}
                </span>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <Link
                href={`/admin/products/${p.slug}`}
                className="press flex h-8 w-8 items-center justify-center rounded-full text-ink/70 hover:bg-ink/[0.06] hover:text-ink"
                aria-label="Modifier"
              >
                <Pencil size={15} />
              </Link>
              <DeleteProductButton slug={p.slug} />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-hairline">
        <table className="w-full text-sm">
          <thead className="bg-surface-soft text-left text-[11px] uppercase tracking-[0.12em] text-text-muted">
            <tr>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3">Famille</th>
              <th className="px-4 py-3">Prix</th>
              <th className="px-4 py-3">Coloris</th>
              <th className="px-4 py-3">Badge</th>
              <th className="px-4 py-3 text-end">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {products.map((p) => (
              <tr key={p.slug} className="hover:bg-surface-soft/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    <div>
                      <p className="font-medium text-ink">{p.title}</p>
                      <p className="text-xs text-text-muted">{p.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-text-muted">{p.categoryName}</td>
                <td className="px-4 py-3 tabular">
                  {p.price} MAD
                  {p.originalPrice && (
                    <span className="ms-2 text-xs text-text-muted line-through">{p.originalPrice}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-text-muted">
                  {p.colors?.map((c) => c.name).join(', ') || '—'}
                </td>
                <td className="px-4 py-3">
                  {p.badge && (
                    <span className="rounded-full bg-ink/[0.06] px-2.5 py-1 text-[11px] font-medium text-ink">
                      {p.badge}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-end">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/admin/products/${p.slug}`}
                      className="press flex h-8 w-8 items-center justify-center rounded-full text-ink/70 hover:bg-ink/[0.06] hover:text-ink"
                      aria-label="Modifier"
                    >
                      <Pencil size={15} />
                    </Link>
                    <DeleteProductButton slug={p.slug} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
