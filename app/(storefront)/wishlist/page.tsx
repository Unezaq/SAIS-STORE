import { getStorefrontProducts } from '@/lib/products'
import { WishlistView } from '@/components/storefront/WishlistView'

export default async function WishlistPage() {
  const products = await getStorefrontProducts()
  return <WishlistView products={products} />
}
