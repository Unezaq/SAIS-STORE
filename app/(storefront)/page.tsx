import Link from 'next/link'
import { ArrowRight, MessageCircle } from 'lucide-react'
import { ScrollHero } from '@/components/storefront/ScrollHero'
import { CategoryRail } from '@/components/storefront/CategoryRail'
import { ProductStory } from '@/components/storefront/ProductStory'
import { HowToOrder } from '@/components/storefront/HowToOrder'
import { Button } from '@/components/ui/Button'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { getStorefrontProducts, getStorefrontProduct, getSettings } from '@/lib/products'

export default async function StorefrontHomePage() {
  const [products, posterProduct, settings] = await Promise.all([
    getStorefrontProducts(),
    getStorefrontProduct('peignoir-douceur-bleu-celeste'),
    getSettings(),
  ])
  const poster = posterProduct?.imageUrl ?? null

  const trust = [
    {
      label: settings.deliveryFee === 0 ? 'Livraison gratuite' : `Livraison : ${settings.deliveryFee} MAD`,
      detail: settings.freeDeliveryMinItems > 0
        ? `Offerte dès ${settings.freeDeliveryMinItems} pièces · 24–48h au Maroc`
        : '24–48h partout au Maroc',
    },
    { label: 'Paiement à la livraison', detail: 'En espèces, à réception' },
    { label: 'Commande en ligne', detail: '2 minutes, sans compte' },
  ]

  const whatsappUrl = `https://wa.me/${settings.whatsappPhone}?text=${encodeURIComponent(
    'Bonjour SAIS, je souhaite passer une commande.'
  )}`

  return (
    <div className="flex flex-col">
      <ScrollHero posterImageUrl={poster} />

      {/* Trust strip */}
      <section className="border-b border-hairline bg-background">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 divide-y divide-hairline px-fib-3 md:grid-cols-3 md:divide-x md:divide-y-0 md:px-fib-4">
          {trust.map((item) => (
            <div key={item.label} className="flex flex-col gap-fib-1 py-fib-3 md:px-fib-3 md:py-fib-4">
              <p className="text-[13px] font-medium text-ink">{item.label}</p>
              <p className="text-xs text-text-muted">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <CategoryRail products={products} />

      <ProductStory products={products} />

      <HowToOrder
        deliveryFee={settings.deliveryFee}
        freeDeliveryMinItems={settings.freeDeliveryMinItems}
      />

      {/* Closing CTA */}
      <ScrollReveal variant="fade-up">
        <section className="mx-auto w-full max-w-7xl px-fib-3 pb-fib-6 md:px-fib-4 md:pb-fib-7">
          <div className="relative overflow-hidden rounded-[28px] bg-surface-soft px-fib-4 py-fib-5 md:px-fib-5 md:py-fib-6">
            <div
              aria-hidden
              className="pointer-events-none absolute -end-20 -top-24 h-[320px] w-[320px] rounded-full bg-accent/10 blur-[90px]"
            />
            <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <p className="text-eyebrow uppercase text-text-muted">Besoin d&apos;aide ?</p>
                <h2 className="mt-2 text-title text-ink">Une question avant de commander ?</h2>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">
                  Nos conseillères vous répondent sur WhatsApp et confirment votre commande en
                  quelques minutes.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <a href={whatsappUrl} target="_blank" rel="noreferrer">
                  <Button size="lg" rightIcon={<MessageCircle size={16} />}>
                    WhatsApp
                  </Button>
                </a>
                <Link href="/collections">
                  <Button size="lg" variant="outline" rightIcon={<ArrowRight size={16} />}>
                    Catalogue
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>
    </div>
  )
}
