import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center px-fib-4 py-fib-6 text-center">
      <p className="text-eyebrow uppercase text-text-muted">Erreur 404</p>
      <h1 className="mt-fib-2 text-title text-ink">Page introuvable</h1>
      <p className="mt-fib-2 text-sm leading-relaxed text-text-muted md:text-[15px]">
        Cette page n’existe pas ou a été déplacée. Retrouvez nos pièces dans la boutique, ou suivez
        votre commande avec votre téléphone et sa référence.
      </p>
      <div className="mt-fib-4 flex flex-col gap-2 sm:flex-row">
        <Link
          href="/boutique"
          className="press inline-flex h-12 items-center justify-center rounded-full bg-ink px-6 text-sm font-medium text-white hover:bg-ink/90"
        >
          Voir la boutique
        </Link>
        <Link
          href="/suivre"
          className="press inline-flex h-12 items-center justify-center rounded-full border border-hairline px-6 text-sm font-medium text-ink hover:bg-surface-soft"
        >
          Suivre ma commande
        </Link>
      </div>
    </main>
  )
}
