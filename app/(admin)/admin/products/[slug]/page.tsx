import { notFound } from 'next/navigation'
import { getProduct } from '@/lib/products'
import { ProductForm } from '@/components/admin/ProductForm'

export default async function EditProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await getProduct(slug)
  if (!product) notFound()

  return (
    <div className="flex flex-col gap-fib-4">
      <div>
        <p className="text-eyebrow uppercase text-text-muted">Catalogue</p>
        <h1 className="mt-fib-1 text-title text-ink">Modifier — {product.title}</h1>
      </div>
      <div className="rounded-[20px] bg-white p-fib-4 shadow-sm ring-1 ring-hairline">
        <ProductForm initial={product} />
      </div>
    </div>
  )
}
