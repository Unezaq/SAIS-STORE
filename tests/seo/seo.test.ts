import { describe, it, expect, vi } from 'vitest'
import robots from '@/app/robots'
import { productJsonLd } from '@/lib/seo'
import { clientEnv } from '@/lib/env'

// Mock getStorefrontProduct for SEO product tests
vi.mock('@/lib/products', () => ({
  getStorefrontProduct: async (slug: string) => {
    if (slug === 'peignoir-douceur') {
      return {
        id: 'prod-1',
        title: 'Peignoir Douceur',
        slug: 'peignoir-douceur',
        slugCategory: 'peignoirs',
        categoryName: 'Peignoirs',
        price: 250,
        originalPrice: 300,
        imageUrl: '/products/sais-01.jpg',
        ref: 'REF-PEIG-01',
        description: 'Peignoir ultra doux.',
      }
    }
    return undefined
  },
}))

describe('SEO — robots.txt configuration', () => {
  it('generates robots.txt with disallow for /admin/ and /api/', () => {
    const config = robots()
    expect(config).toBeDefined()
    expect(config.sitemap).toBe(`${clientEnv.NEXT_PUBLIC_SITE_URL}/sitemap.xml`)
    
    const rules = Array.isArray(config.rules) ? config.rules[0] : config.rules
    expect(rules.userAgent).toBe('*')
    expect(rules.allow).toBe('/')
    expect(rules.disallow).toContain('/admin/')
    expect(rules.disallow).toContain('/admin')
    expect(rules.disallow).toContain('/api/')
    expect(rules.disallow).toContain('/~offline')
    expect(rules.disallow).toContain('/sw.js')
  })
})

describe('SEO — Product JSON-LD structured data', () => {
  it('produces valid Schema.org Product structured data with SKU and condition', async () => {
    const jsonLd = await productJsonLd('peignoir-douceur')
    expect(jsonLd).not.toBeNull()
    if (!jsonLd) return

    expect(jsonLd['@context']).toBe('https://schema.org')
    expect(jsonLd['@type']).toBe('Product')
    expect(jsonLd.name).toBe('Peignoir Douceur')
    expect(jsonLd.description).toBe('Peignoir ultra doux.')
    expect(jsonLd.sku).toBe('REF-PEIG-01')
    expect(jsonLd.brand).toEqual({ '@type': 'Brand', name: 'SAIS Store' })

    const offers = jsonLd.offers as any
    expect(offers).toBeDefined()
    expect(offers['@type']).toBe('Offer')
    expect(offers.priceCurrency).toBe('MAD')
    expect(offers.price).toBe(250)
    expect(offers.availability).toBe('https://schema.org/InStock')
    expect(offers.itemCondition).toBe('https://schema.org/NewCondition')
    expect(offers.areaServed).toBe('MA')
    expect(offers.url).toBe(`${clientEnv.NEXT_PUBLIC_SITE_URL}/products/peignoir-douceur`)
  })

  it('returns null for nonexistent product slug', async () => {
    const jsonLd = await productJsonLd('nonexistent-product')
    expect(jsonLd).toBeNull()
  })
})
