import { ShieldAlert } from 'lucide-react'
import { RISK_LEVEL_LABELS, RISK_LEVEL_STYLES, type OrderRisk } from '@/lib/risk'

/** Compact risk pill; the reasons are available on hover. */
export function OrderRiskBadge({ risk }: { risk: OrderRisk }) {
  return (
    <span
      title={risk.reasons.join(' · ')}
      className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${RISK_LEVEL_STYLES[risk.level]}`}
    >
      <ShieldAlert size={11} />
      {RISK_LEVEL_LABELS[risk.level]}
    </span>
  )
}
