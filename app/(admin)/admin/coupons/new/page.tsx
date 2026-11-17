import { CouponForm } from '@/components/admin/CouponForm'

export default function NewCouponPage() {
  return (
    <div className="flex flex-col gap-fib-4">
      <div>
        <p className="text-eyebrow uppercase text-text-muted">Promotions</p>
        <h1 className="mt-fib-1 text-title text-ink">Nouveau code de réduction</h1>
        <p className="mt-fib-1 text-sm text-text-muted">
          Créez un code promo applicable en caisse pour un pourcentage ou un montant fixe.
        </p>
      </div>

      <div className="rounded-[20px] bg-white p-fib-4 shadow-sm ring-1 ring-hairline">
        <CouponForm />
      </div>
    </div>
  )
}
