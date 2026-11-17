import { notFound } from 'next/navigation'
import { CouponForm } from '@/components/admin/CouponForm'
import { getCoupons } from '@/lib/products'

export default async function EditCouponPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const coupons = await getCoupons()
  const coupon = coupons.find((candidate) => candidate.id === id)
  if (!coupon) notFound()

  return (
    <div className="flex flex-col gap-fib-4">
      <div>
        <p className="text-eyebrow uppercase text-text-muted">Promotions</p>
        <h1 className="mt-fib-1 text-title text-ink">Modifier — {coupon.code.toUpperCase()}</h1>
        <p className="mt-fib-1 text-sm text-text-muted">
          {coupon.usedCount} utilisation{coupon.usedCount > 1 ? 's' : ''} enregistrée
          {coupon.usedCount > 1 ? 's' : ''}.
        </p>
      </div>

      <div className="rounded-[20px] bg-white p-fib-4 shadow-sm ring-1 ring-hairline">
        <CouponForm coupon={coupon} />
      </div>
    </div>
  )
}
