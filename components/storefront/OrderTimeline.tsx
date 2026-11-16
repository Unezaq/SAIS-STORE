import { AlertCircle } from 'lucide-react'
import type { OrderStatus } from '@/lib/orderStatus'
import {
  ORDER_FLOW,
  ORDER_STATUS_DESCRIPTIONS,
  ORDER_STATUS_LABELS,
  orderStepIndex,
} from '@/lib/orderStatus'
import { cn } from '@/lib/utils'

/**
 * The four steps every order goes through, so the customer always knows what
 * happens next instead of having to ask on WhatsApp.
 */
export function OrderTimeline({ status }: { status: OrderStatus }) {
  const cancelled = status === 'annulee'
  const currentIndex = orderStepIndex(status)

  return (
    <div className="flex flex-col gap-fib-2">
      {cancelled && (
        <div className="flex items-start gap-2 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>{ORDER_STATUS_DESCRIPTIONS.annulee}</p>
        </div>
      )}

      <ol className="grid gap-fib-2 sm:grid-cols-4">
        {ORDER_FLOW.map((step, index) => {
          const done = !cancelled && index <= currentIndex
          const current = !cancelled && index === currentIndex

          return (
            <li
              key={step}
              className={cn(
                'flex items-start gap-2.5 rounded-2xl p-3 ring-1 transition-colors',
                current
                  ? 'bg-primary/5 ring-primary/20'
                  : done
                    ? 'bg-surface-soft ring-hairline'
                    : 'bg-white ring-hairline'
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                  done ? 'bg-primary text-white' : 'bg-ink/[0.06] text-text-muted'
                )}
              >
                {done ? '✓' : index + 1}
              </span>
              <div className="min-w-0">
                <p
                  className={cn(
                    'text-[12px] font-semibold',
                    done ? 'text-ink' : 'text-text-muted'
                  )}
                >
                  {ORDER_STATUS_LABELS[step]}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-text-muted">
                  {ORDER_STATUS_DESCRIPTIONS[step]}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
