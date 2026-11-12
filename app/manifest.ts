import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SAIS Store — Boutique de Mode Féminine',
    short_name: 'SAIS Store',
    description: 'Boutique en ligne de vêtements féminins au Maroc. Paiement à la livraison.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFF8F0',
    theme_color: '#1B4332',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}

