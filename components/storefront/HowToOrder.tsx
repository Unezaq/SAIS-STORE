import { MessageCircle, MousePointerClick, Wallet } from 'lucide-react'
import { ScrollReveal } from '@/components/ui/ScrollReveal'

const steps = [
  {
    icon: MousePointerClick,
    title: 'Choisissez la pièce',
    body: 'Parcourez les familles, ouvrez la fiche et choisissez votre taille.',
  },
  {
    icon: MessageCircle,
    title: 'Confirmez sur WhatsApp',
    body: 'Un message suffit : une conseillère valide votre commande en quelques minutes.',
  },
  {
    icon: Wallet,
    title: 'Payez à la livraison',
    body: 'Vous réglez en espèces à la réception, partout au Maroc, en 24–48h.',
  },
]

export function HowToOrder() {
  return (
    <section className="mx-auto w-full max-w-7xl px-fib-3 pb-fib-6 md:px-fib-4 md:pb-fib-7">
      <ScrollReveal variant="fade-up">
        <div className="max-w-2xl">
          <p className="text-eyebrow uppercase text-text-muted">Commander</p>
          <h2 className="mt-fib-1 text-title text-ink">Trois étapes, aucun compte à créer.</h2>
        </div>
      </ScrollReveal>

      <div className="mt-fib-4 grid gap-fib-2 md:mt-fib-5 md:grid-cols-3 md:gap-fib-3">
        {steps.map((step, index) => {
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
