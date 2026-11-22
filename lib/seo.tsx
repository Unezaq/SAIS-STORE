import type {
  Organization,
  Product,
  Offer,
  FAQPage,
  WebSite,
  BreadcrumbList,
  LocalBusiness,
  WithContext,
} from 'schema-dts'
import { clientEnv } from '@/lib/env'
import { getStorefrontProduct } from '@/lib/products'

/**
 * Structured data (JSON-LD) helpers, typed with `schema-dts` (Google's own
 * types for schema.org). Google, Bing and WhatsApp previews read these to
 * enrich results: store info, product prices/stock, FAQ answers.
 */

const SITE_URL = clientEnv.NEXT_PUBLIC_SITE_URL
const SITE_NAME = 'SAIS Store'
const STORE_ADDRESS = {
  '@type': 'PostalAddress' as const,
  streetAddress: 'Avenue Hassan II, Centre Ville',
  addressLocality: 'Kenitra',
  addressRegion: 'Rabat-Salé-Kénitra',
  postalCode: '14000',
  addressCountry: 'MA',
}

/** Renders a JSON-LD block. Server-safe: no client JS involved. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is escaped so it can never break out of the tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}

export function organizationJsonLd(): WithContext<Organization> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icons/icon-192.png`,
    address: STORE_ADDRESS,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      areaServed: 'MA',
      availableLanguage: ['fr', 'ar'],
    },
    sameAs: [],
  }
}

export function localBusinessJsonLd(): WithContext<LocalBusiness> {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: `${SITE_NAME} Kenitra`,
    image: `${SITE_URL}/products/sais-01.jpg`,
    address: STORE_ADDRESS,
    priceRange: '200-400 MAD',
    areaServed: ['Kenitra', 'Rabat', 'Casablanca', 'Maroc'],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Vêtements féminins — pyjamas, peignoirs, ensembles hiver',
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '09:00',
      closes: '21:00',
    },
  }
}

export function websiteJsonLd(): WithContext<WebSite> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: 'fr',
  }
}

export async function productJsonLd(slug: string): Promise<WithContext<Product> | null> {
  const product = await getStorefrontProduct(slug)
  if (!product) return null

  const offer: Offer = {
    '@type': 'Offer',
    priceCurrency: 'MAD',
    price: product.price,
    availability: 'https://schema.org/InStock',
    itemCondition: 'https://schema.org/NewCondition',
    areaServed: 'MA',
    url: `${SITE_URL}/products/${product.slug}`,
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description,
    image: `${SITE_URL}${product.imageUrl}`,
    category: product.categoryName,
    sku: product.ref || product.slug,
    brand: { '@type': 'Brand', name: SITE_NAME },
    offers: offer,
  }
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>
): WithContext<BreadcrumbList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  }
}

export function faqJsonLd(
  faqs: Array<{ question: string; answer: string }>
): WithContext<FAQPage> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}
