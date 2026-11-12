import { ProductForm } from '@/components/admin/ProductForm'

export default function NewProductPage() {
  return (
    <div className="flex flex-col gap-fib-4">
      <div>
        <p className="text-eyebrow uppercase text-text-muted">Catalogue</p>
        <h1 className="mt-fib-1 text-title text-ink">Nouveau produit</h1>
      </div>
      <div className="rounded-[20px] bg-white p-fib-4 shadow-sm ring-1 ring-hairline">
        <ProductForm />
      </div>
    </div>
  )
}
