import { SmoothScrollProvider } from '@/components/storefront/SmoothScrollProvider'
import { AdaptiveNavigation } from '@/components/layout/AdaptiveNavigation'
import { PageTransition } from '@/components/layout/PageTransition'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { CartProvider } from '@/components/storefront/CartProvider'
import { getSettings } from '@/lib/products'
import { getAuthenticatedUser } from '@/lib/supabase/auth'
import { getCustomerFromSession } from '@/lib/auth/current-customer'

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [settings, authUser, customer] = await Promise.all([
    getSettings(),
    getAuthenticatedUser(),
    getCustomerFromSession(),
  ])
  const isAdmin = authUser?.app_metadata?.role === 'admin'
  const isCustomer = Boolean(customer)

  return (
    <CartProvider>
      <SmoothScrollProvider>
        <div className="flex min-h-dvh flex-col bg-background">
          <AdaptiveNavigation settings={settings} isAdmin={isAdmin} />
          <main className="relative z-10 flex-1 bg-background">
            <PageTransition>{children}</PageTransition>
          </main>
          <SiteFooter
            whatsappPhone={settings.whatsappPhone}
            deliveryFee={settings.deliveryFee}
            freeDeliveryMinItems={settings.freeDeliveryMinItems}
          />
        </div>
      </SmoothScrollProvider>
    </CartProvider>
  )
}
