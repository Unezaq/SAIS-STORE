import { MessageCircle, MousePointerClick, Wallet } from 'lucide-react'
import { ScrollReveal } from '@/components/ui/ScrollReveal'

const steps = (deliveryFee: number, freeDeliveryMinItems: number) => [
  {
    icon: MousePointerClick,
    title: 'Choisissez la pièce',
    body: 'Parcourez les familles, ouvrez la fiche et choisissez votre taille.',
  },
  {
    icon: MessageCircle,
    title: 'Validez votre commande',
    body: 'Ajoutez vos coordonnées de livraison et envoyez votre commande sans créer de compte.',
  },
  {
    icon: Wallet,
    title: 'Payez à la livraison',
    body: `${deliveryFee > 0 ? `Livraison à ${deliveryFee} MAD` : 'Livraison gratuite'} partout au Maroc en 24–48h${freeDeliveryMinItems > 0 ? `, offerte dès ${freeDeliveryMinItems} pièces` : ''}. Vous réglez en espèces à la réception.`,
  },
]

export function HowToOrder({
  deliveryFee,
  freeDeliveryMinItems,
}: {
  deliveryFee: number
  freeDeliveryMinItems: number
}) {
  const orderSteps = steps(deliveryFee, freeDeliveryMinItems)

  return (
    <section className="mx-auto w-full max-w-7xl px-fib-3 pb-fib-6 md:px-fib-4 md:pb-fib-7">
      <ScrollReveal variant="fade-up">
        <div className="max-w-2xl">
          <p className="text-eyebrow uppercase text-text-muted">Commander</p>
          <h2 className="mt-fib-1 text-title text-ink">Trois étapes, aucun compte à créer.</h2>
        </div>
      </ScrollReveal>

      <div className="mt-fib-4 grid gap-fib-2 md:mt-fib-5 md:grid-cols-3 md:gap-fib-3">
        {orderSteps.map((step, index) => {
          const Icon = step.icon
          return (
            <ScrollReveal key={step.title} variant="fade-up" delay={index * 0.08}>
              <div className="flex h-full flex-col justify-between rounded-[24px] bg-surface-soft p-fib-3 md:min-h-[220px] md:p-fib-4">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white">
                    <Icon size={17} strokeWidth={1.8} />
                  </span>
                  <span className="tabular text-xs font-medium text-text-muted">0{index + 1}</span>
                </div>
                <div className="mt-fib-4">
                  <h3 className="text-heading text-ink">{step.title}</h3>
                  <p className="mt-fib-1 text-sm leading-relaxed text-text-muted">{step.body}</p>
                </div>
              </div>
            </ScrollReveal>
          )
        })}
      </div>
    </section>
  )
}
