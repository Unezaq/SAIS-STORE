'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Erreur inattendue côté client.', error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center px-fib-4 py-fib-6 text-center">
      <p className="text-eyebrow uppercase text-text-muted">Erreur</p>
      <h1 className="mt-fib-2 text-title text-ink">Une erreur est survenue</h1>
      <p className="mt-fib-2 text-sm leading-relaxed text-text-muted md:text-[15px]">
        La page n’a pas pu s’afficher. Réessayez, ou revenez à la boutique. Votre panier est
        conservé.
      </p>
      <div className="mt-fib-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="press inline-flex h-12 items-center justify-center rounded-full bg-ink px-6 text-sm font-medium text-white hover:bg-ink/90"
        >
          Réessayer
        </button>
        <Link
          href="/boutique"
          className="press inline-flex h-12 items-center justify-center rounded-full border border-hairline px-6 text-sm font-medium text-ink hover:bg-surface-soft"
        >
          Voir la boutique
        </Link>
        <Link
          href="/suivre"
          className="press inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-medium text-text-muted hover:text-ink"
        >
          Suivre ma commande
        </Link>
      </div>
    </main>
  )
}
