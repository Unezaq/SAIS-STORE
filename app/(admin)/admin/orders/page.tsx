import { getOrders } from '@/lib/products'
import { OrderStatusSelect } from '@/components/admin/OrderStatusSelect'

const STATUS_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  confirmee: 'Confirmée',
  expediee: 'Expédiée',
  livree: 'Livrée',
  annulee: 'Annulée',
}

export default async function AdminOrdersPage() {
  const orders = await getOrders()

  return (
    <div className="flex flex-col gap-fib-4">
      <div>
        <p className="text-eyebrow uppercase text-text-muted">Ventes</p>
        <h1 className="mt-fib-1 text-title text-ink">Commandes</h1>
        <p className="mt-fib-1 text-sm text-text-muted">{orders.length} commande{orders.length > 1 ? 's' : ''}.</p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-[20px] bg-white p-fib-4 text-center text-text-muted shadow-sm ring-1 ring-hairline">
          Aucune commande pour le moment.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-hairline">
          <table className="w-full text-sm">
            <thead className="bg-surface-soft text-left text-[11px] uppercase tracking-[0.12em] text-text-muted">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Articles</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-surface-soft/60">
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">{o.id}</td>
                  <td className="px-4 py-3 font-medium text-ink">{o.customerName}</td>
                  <td className="px-4 py-3 tabular text-text-muted">{o.phone}</td>
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {o.items.map((i) => `${i.title} (${i.color ?? '—'}, ${i.size ?? '—'}) ×${i.quantity}`).join(' · ')}
                  </td>
                  <td className="px-4 py-3 tabular font-medium">{o.total} MAD</td>
                  <td className="px-4 py-3">
                    <OrderStatusSelect orderId={o.id} currentStatus={o.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {new Date(o.createdAt).toLocaleDateString('fr-MA')}
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
