import { AlertCircle, CheckCircle, Clock, RefreshCw, ShieldCheck, Truck } from 'lucide-react'
import type { OrderStatus } from '@/lib/orderStatus'
import { ORDER_STATUS_LABELS, ORDER_STATUS_STYLES } from '@/lib/orderStatus'
import { cn } from '@/lib/utils'

const ICONS: Record<OrderStatus, typeof Clock> = {
  en_attente: Clock,
  confirmee: ShieldCheck,
  expediee: Truck,
  livree: CheckCircle,
  annulee: AlertCircle,
  returned: RefreshCw,
  refunded: RefreshCw,
}

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus
  className?: string
}) {
  const Icon = ICONS[status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1',
        ORDER_STATUS_STYLES[status],
        className
      )}
    >
      <Icon size={12} strokeWidth={2} />
      {ORDER_STATUS_LABELS[status]}
    </span>
  )
}
