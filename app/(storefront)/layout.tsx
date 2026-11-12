'use client'

import { SmoothScrollProvider } from '@/components/storefront/SmoothScrollProvider'
import { AdaptiveNavigation } from '@/components/layout/AdaptiveNavigation'
import { PageTransition } from '@/components/layout/PageTransition'
import { SiteFooter } from '@/components/layout/SiteFooter'

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SmoothScrollProvider>
      <div className="flex min-h-dvh flex-col bg-background">
        <AdaptiveNavigation />
        <main className="relative z-10 flex-1 bg-background">
          <PageTransition>{children}</PageTransition>
        </main>
        <SiteFooter />
      </div>
    </SmoothScrollProvider>
  )
}
