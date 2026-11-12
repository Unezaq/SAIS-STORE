// SPIKE 5: Minimal PWA install
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SAIS Store — متجر سايس',
    short_name: 'SAIS',
    description: 'Women\'s fashion store — متجر أزياء نسائية',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFF8F0',
    theme_color: '#1B4332',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  }
}

