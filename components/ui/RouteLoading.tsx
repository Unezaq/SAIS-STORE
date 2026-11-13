export function RouteLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto flex min-h-[55vh] w-full max-w-7xl flex-col items-center justify-center px-5 py-12"
    >
      <span
        aria-hidden="true"
        className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary/15 border-t-primary"
      />
      <span className="mt-4 text-sm font-medium text-text-muted">Chargement de la page…</span>
      <span className="sr-only">Le contenu arrive, veuillez patienter.</span>
    </div>
  )
}
