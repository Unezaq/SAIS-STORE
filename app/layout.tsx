import type { Metadata, Viewport } from 'next'
import Providers from './providers'
import { JsonLd, organizationJsonLd, websiteJsonLd, localBusinessJsonLd } from '@/lib/seo'
import { ToastProvider } from '@/components/ui/Toast'
import { clientEnv } from '@/lib/env'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default: 'SAIS Store — Vêtements Féminins Kenitra | Pyjamas & Peignoirs',
    template: '%s | SAIS Store Kenitra',
  },
  description:
    'SAIS Store à Kenitra — pyjamas polaires, peignoirs et ensembles hiver pour femme. Livraison 24–48h partout au Maroc, paiement à la livraison par WhatsApp.',
  keywords: [
    'pyjama polaire Kenitra',
    'peignoir femme Kenitra',
    'ensemble hiver femme Kenitra',
    'vêtement intérieur femme Maroc',
    'boutique femme Kenitra',
    'commande WhatsApp Kenitra',
    'livraison partout au Maroc',
    'SAIS Store Kenitra',
    'pyjama polaire Maroc',
    'peignoir femme Maroc',
    'ensemble hiver femme',
    'commande WhatsApp Maroc',
  ],
  authors: [{ name: 'SAIS Store' }],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'fr_MA',
    url: clientEnv.NEXT_PUBLIC_SITE_URL,
    siteName: 'SAIS Store Kenitra',
    title: 'SAIS Store — Vêtements Féminins Kenitra',
    description:
      'Pyjamas polaires, peignoirs et ensembles hiver ultra doux à Kenitra. Livraison 24–48h partout au Maroc, paiement à la livraison.',
    images: [
      {
        url: '/products/sais-01.jpg',
        width: 1200,
        height: 630,
        alt: 'SAIS Store Kenitra — peignoir Douceur Bleu Céleste',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SAIS Store — Vêtements Féminins Kenitra',
    description:
      'Pyjamas polaires, peignoirs et ensembles hiver ultra doux. Livraison 24–48h, paiement à la livraison.',
    images: ['/products/sais-01.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#FFF8F0',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" dir="ltr">
      <head>
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
        <JsonLd data={localBusinessJsonLd()} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,1000&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh bg-background text-text font-sans antialiased">
        <ToastProvider>
          <Providers>
            {children}
          </Providers>
        </ToastProvider>
      </body>
    </html>
  )
}
