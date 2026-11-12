import './globals.css'

export const metadata = {
  title: 'SAIS Spikes',
  description: 'Technology spike experiments',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
      </head>
      <body className="bg-background text-text font-sans">
        {children}
      </body>
    </html>
  )
}

