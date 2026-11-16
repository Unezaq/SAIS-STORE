import Link from 'next/link'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { upsertCoupon } from '@/lib/products'
import { formatMAD } from '@/lib/utils'

const couponSchema = z.object({
  code: z.string().trim().min(3).max(32).toLowerCase(),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().int().min(1),
  minOrder: z.number().int().min(0).default(0),
  expiresAt: z.string().optional(),
  maxUses: z.number().int().min(1).optional(),
  perUserLimit: z.number().int().min(1).optional(),
  isActive: z.boolean().default(true),
})

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

function CouponForm() {
  return (
    <form className="flex flex-col gap-fib-4">
      <div className="grid gap-fib-3 md:grid-cols-2">
        <Input
          label="Code (ex. BIENVENUE10)"
          name="code"
          placeholder="BIENVENUE10"
          helperText="Min. 3 caractères, converti en minuscules."
          required
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-eyebrow uppercase text-text-muted">Type de réduction</label>
          <select
            name="type"
            defaultValue="percentage"
            className="rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink"
          >
            <option value="percentage">Pourcentage (%)</option>
            <option value="fixed">Montant fixe (MAD)</option>
          </select>
        </div>
      </div>

      <div className="grid gap-fib-3 md:grid-cols-3">
        <Input
          label="Valeur"
          name="value"
          type="number"
          defaultValue="10"
          placeholder="10"
          helperText="10 = 10% ou 10,00 dh selon le type"
          required
        />
        <Input
          label="Commande minimum (MAD)"
          name="minOrder"
          type="number"
          defaultValue="0"
          placeholder="0"
          helperText="Optionnel"
        />
        <Input
          label="Utilisations max"
          name="maxUses"
          type="number"
          placeholder="Optionnel"
          helperText="Laissez vide pour illimité."
        />
      </div>

      <div className="grid gap-fib-3 md:grid-cols-2">
        <Input
          label="Expire le"
          name="expiresAt"
          type="date"
          placeholder="Optionnel"
          helperText="Laissez vide pour illimité."
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-eyebrow uppercase text-text-muted">Utilisation par client</label>
          <Input
            name="perUserLimit"
            type="number"
            placeholder="Optionnel"
            helperText="Ex. 1 pour une fois par client."
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-eyebrow uppercase text-text-muted">Actif</label>
        <select
          name="isActive"
          defaultValue="true"
          className="rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink"
        >
          <option value="true">Oui</option>
          <option value="false">Non (brouillon)</option>
        </select>
      </div>

      <div className="mt-fib-4 flex gap-3">
        <Button type="submit" size="lg">
          Créer le code
        </Button>
        <Link href="/admin/coupons" className="press inline-flex items-center gap-2 rounded-full border border-hairline px-fib-3 py-fib-1 text-sm font-medium text-ink hover:bg-surface-soft">
          Annuler
        </Link>
      </div>
    </form>
  )
}
