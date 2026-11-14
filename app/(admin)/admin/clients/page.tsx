import { getClients } from '@/lib/products'

export default async function AdminClientsPage() {
  const clients = await getClients()

  return (
    <div className="flex flex-col gap-fib-4">
      <div>
        <p className="text-eyebrow uppercase text-text-muted">Base clients</p>
        <h1 className="mt-fib-1 text-title text-ink">Clients</h1>
        <p className="mt-fib-1 text-sm text-text-muted">{clients.length} client{clients.length > 1 ? 's' : ''}.</p>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-[20px] bg-white p-fib-4 text-center text-text-muted shadow-sm ring-1 ring-hairline">
          Aucun client pour le moment. Les comptes apparaissent après confirmation de l’email, et les clients invités après leur première commande.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-hairline">
          <table className="w-full text-sm">
            <thead className="bg-surface-soft text-left text-[11px] uppercase tracking-[0.12em] text-text-muted">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Adresse</th>
                <th className="px-4 py-3">Commandes</th>
                <th className="px-4 py-3">Inscrit le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-surface-soft/60">
                  <td className="px-4 py-3 font-medium text-ink">{c.firstName} {c.lastName}</td>
                  <td className="px-4 py-3 tabular text-text-muted">{c.phone}</td>
                  <td className="px-4 py-3 text-text-muted">{c.address || '—'}</td>
                  <td className="px-4 py-3 tabular">{c.orderCount}</td>
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {new Date(c.createdAt).toLocaleDateString('fr-MA')}
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
