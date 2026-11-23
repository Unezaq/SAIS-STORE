import { getAdminClients } from '@/lib/products'

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q: rawQuery } = await searchParams
  const query = (rawQuery ?? '').trim().toLowerCase()
  const clients = await getAdminClients()
  const visible = query
    ? clients.filter((client) =>
        [client.name, client.phone, client.email ?? '']
          .join(' ')
          .toLowerCase()
          .includes(query)
      )
    : clients
  const registeredCount = clients.filter((client) => client.kind === 'customer').length

  return (
    <div className="flex flex-col gap-fib-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow uppercase text-text-muted">Base clients</p>
          <h1 className="mt-fib-1 text-title text-ink">Clients</h1>
          <p className="mt-fib-1 text-sm text-text-muted">
            {clients.length} client{clients.length > 1 ? 's' : ''} · {registeredCount} avec compte ·
            les invités apparaissent après leur première commande.
          </p>
        </div>
        <form className="flex items-end gap-2" action="/admin/clients">
          <label className="grid gap-1.5 text-sm font-medium text-ink">
            Rechercher
            <input
              name="q"
              type="search"
              defaultValue={rawQuery ?? ''}
              placeholder="Nom, téléphone, email"
              className="w-full sm:w-56 rounded-xl border border-hairline bg-white px-4 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </label>
          <button
            type="submit"
            className="press h-[38px] rounded-full border border-hairline px-4 text-sm font-medium text-ink hover:bg-surface-soft"
          >
            Filtrer
          </button>
        </form>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-[20px] bg-white p-fib-4 text-center text-text-muted shadow-sm ring-1 ring-hairline">
          {query
            ? 'Aucun client ne correspond à cette recherche.'
            : 'Aucun client pour le moment. Les comptes apparaissent après leur inscription, et les clients invités après leur première commande.'}
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="grid gap-3 md:hidden">
            {visible.map((client) => (
              <div
                key={`${client.kind}-${client.id}`}
                className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-hairline"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="font-medium text-ink">{client.name || '—'}</p>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${
                      client.kind === 'customer'
                        ? 'bg-primary/10 text-primary ring-primary/15'
                        : 'bg-surface-soft text-text-muted ring-hairline'
                    }`}
                  >
                    {client.kind === 'customer' ? 'Compte' : 'Invité'}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="text-text-muted">
                    <span className="text-ink/60">Tél : </span>
                    <a href={`tel:${client.phone}`} className="hover:text-ink hover:underline">
                      {client.phone}
                    </a>
                  </p>
                  {client.email && (
                    <p className="text-text-muted truncate">
                      <span className="text-ink/60">Email : </span>
                      {client.email}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-hairline mt-2">
                    <p className="text-xs text-text-muted">
                      Commandes : <span className="font-medium text-ink">{client.orderCount}</span>
                    </p>
                    <p className="text-xs text-text-muted">
                      {new Date(client.joinedAt).toLocaleDateString('fr-MA')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto rounded-[20px] bg-white shadow-sm ring-1 ring-hairline">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-surface-soft text-left text-[11px] uppercase tracking-[0.12em] text-text-muted">
                <tr>
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Téléphone</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Commandes</th>
                  <th className="px-4 py-3">Inscrit le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {visible.map((client) => (
                  <tr key={`${client.kind}-${client.id}`} className="hover:bg-surface-soft/60">
                    <td className="px-4 py-3 font-medium text-ink">{client.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${
                          client.kind === 'customer'
                            ? 'bg-primary/10 text-primary ring-primary/15'
                            : 'bg-surface-soft text-text-muted ring-hairline'
                        }`}
                      >
                        {client.kind === 'customer' ? 'Compte' : 'Invité'}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular text-text-muted">
                      <a href={`tel:${client.phone}`} className="hover:text-ink hover:underline">
                        {client.phone}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{client.email || '—'}</td>
                    <td className="px-4 py-3 tabular text-ink">{client.orderCount}</td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      {new Date(client.joinedAt).toLocaleDateString('fr-MA')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
