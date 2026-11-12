import Link from 'next/link'
import { WifiOff } from 'lucide-react'

export default function OfflinePage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 text-center bg-background">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
        <WifiOff size={32} />
      </div>
      <h1 className="text-2xl font-bold text-primary mb-2">Vous êtes hors ligne</h1>
      <p className="text-sm text-text-muted max-w-sm mb-6">
        Veuillez vérifier votre connexion Internet. Vos articles enregistrés dans le panier restent accessibles.
      </p>
      <Link
        href="/"
        className="px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-light transition-colors"
      >
        Réessayer
      </Link>
    </main>
  )
}

