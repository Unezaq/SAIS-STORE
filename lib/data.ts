export interface ProductColor {
  name: string
  hex: string
}

export interface Product {
  id: string
  title: string
  slug: string
  slugCategory: string
  price: number
  originalPrice?: number
  imageUrl: string
  /** Colorways available for this shape — each shape (design) has its own colors. */
  colors?: ProductColor[]
  /** Optional per-colorway photo (keyed by color name). */
  colorImages?: Record<string, string>
  /** Showcase video for product cards — `/videos/products/{slug}.mp4` when provided. */
  videoUrl?: string
  /** Supplier reference, included in WhatsApp orders. */
  ref?: string
  /** Sizes offered, shown as chips on the product page. */
  sizes?: string[]
  /** Fabric / material line shown under the description. */
  fabric?: string
  /** Highlight bullets shown on the product page. */
  features?: string[]
  categoryName: string
  badge?: string
  description?: string
}

export interface Category {
  name: string
  slug: string
  count: string
  imageUrl: string
}

/*
 * Catalogue réel SAIS — vêtements d'intérieur (pyjamas polaires, peignoirs,
 * ensembles hiver). Les photos viennent de `public/products/sais-*.jpg`.
 *
 * Règle importante : un PRODUIT = une COUPE (chkel), pas une couleur.
 * Chaque coupe existe en plusieurs coloris et tailles — les coloris sont
 * listés dans `colors` et, quand on a la photo, dans `colorImages`.
 */
export const PRODUCTS_SEED: Product[] = [
  {
    id: 'p1',
    title: 'Peignoir Douceur',
    slug: 'peignoir-douceur-bleu-celeste',
    price: 299,
    originalPrice: 349,
    imageUrl: '/products/sais-01.jpg',
    colors: [{ name: 'Bleu Céleste', hex: '#B8D4E8' }],
    sizes: ['M', 'L', 'XL', 'XXL'],
    fabric: 'Sherpa duveteux ultra doux',
    features: ['Ceinture nouée', 'Poches latérales', 'Ultra doux après la douche'],
    categoryName: 'Peignoirs',
    slugCategory: 'peignoirs',
    badge: 'Tendance',
    ref: '2985',
    description: 'Peignoir long en tissu doux et duveteux, ceinture nouée et poches latérales. Confort immédiat après la douche ou pour vos soirées détente.',
  },
  {
    id: 'p2',
    title: 'Ensemble Chevrons Cardigan',
    slug: 'ensemble-hiver-chevrons-taupe',
    price: 299,
    imageUrl: '/products/sais-02.jpg',
    colors: [
      { name: 'Taupe', hex: '#8B7E74' },
      { name: 'Bleu', hex: '#A8C5D8' },
      { name: 'Mauve', hex: '#C9B8D4' },
      { name: 'Vert', hex: '#A8C4A8' },
    ],
    colorImages: {
      Taupe: '/products/sais-02.jpg',
    },
    sizes: ['M', 'L', 'XL', 'XXL'],
    fabric: 'Maille douce motif chevrons',
    features: ['Boutonnage pression', 'Coupe relaxed', 'Gilet + pantalon'],
    categoryName: 'Ensembles Hiver',
    slugCategory: 'ensembles',
    ref: '2993',
    description: 'Ensemble gilet + pantalon en maille douce à motif chevrons. Boutonnage pression, coupe relaxed, disponible du M au XXL.',
  },
  {
    id: 'p3',
    title: 'Pyjama Panthère Layette',
    slug: 'pyjama-panthere-bleu-layette',
    price: 249,
    originalPrice: 299,
    imageUrl: '/products/sais-03.jpg',
    colors: [{ name: 'Bleu', hex: '#A8C5D8' }],
    sizes: ['M', 'L', 'XL', 'XXL'],
    fabric: 'Layette douce',
    features: ['Col chemise', 'Boutons nacrés', 'Poches brodées'],
    categoryName: 'Pyjamas Polaires',
    slugCategory: 'pyjamas',
    description: 'Pyjama deux pièces en layette douce, imprimé panthère bleu. Col chemise, boutons nacrés et poches brodées.',
  },
  {
    id: 'p4',
    title: 'Peignoir Pastel Dentelle',
    slug: 'peignoir-pastel-rose-poudre',
    price: 299,
    imageUrl: '/products/sais-04.jpg',
    colors: [
      { name: 'Rose', hex: '#F2C6D4' },
      { name: 'Crème', hex: '#F2E9DC' },
      { name: 'Menthe', hex: '#C8E0D4' },
      { name: 'Bleu', hex: '#C4D8E8' },
    ],
    colorImages: {
      Rose: '/products/sais-04.jpg',
    },
    sizes: ['M', 'L', 'XL', 'XXL'],
    fabric: 'Tissu ultra doux finitions dentelle',
    features: ['Finitions dentelle', 'Plusieurs coloris'],
    categoryName: 'Peignoirs',
    slugCategory: 'peignoirs',
    description: 'Peignoir long pastel au toucher ultra doux, finitions dentelle. Disponible en plusieurs coloris : rose, crème, menthe et bleu.',
  },
  {
    id: 'p5',
    title: 'Ensemble Chorouk Capuche',
    slug: 'ensemble-chorouk-rose-capuche',
    price: 329,
    originalPrice: 379,
    imageUrl: '/products/sais-05.jpg',
    colors: [{ name: 'Rose', hex: '#F2C6D4' }],
    sizes: ['M', 'L', 'XL', 'XXL'],
    fabric: 'Tissu d\'hiver chaud et léger',
    features: ['Capuche à pompons', 'Poche kangourou', 'Glands décoratifs'],
    categoryName: 'Ensembles Hiver',
    slugCategory: 'ensembles',
    badge: 'Nouveau',
    description: 'Ensemble hiver à capuche avec pompons, poche kangourou et glands. Tissu d\'hiver chaud et léger, coupe confortable.',
  },
  {
    id: 'p6',
    title: 'Ensemble Chorouk Ourson',
    slug: 'ensemble-chorouk-vert-ourson',
    price: 329,
    imageUrl: '/products/sais-06.jpg',
    colors: [{ name: 'Vert Sauge', hex: '#A8C4A8' }],
    sizes: ['M', 'L', 'XL', 'XXL'],
    fabric: 'Molleton chaud',
    features: ['Écusson ourson brodé', 'Jogger côtelé', 'Ultra doux'],
    categoryName: 'Ensembles Hiver',
    slugCategory: 'ensembles',
    badge: 'Nouveau',
    description: 'Pull molletonné vert sauge avec écusson ourson brodé, assorti à un jogger côtelé. Ultra doux et chaud pour l\'hiver.',
  },
  {
    id: 'p7',
    title: 'Ensemble Chorouk Zipé',
    slug: 'ensemble-chorouk-vert-zipe',
    price: 329,
    imageUrl: '/products/sais-08.jpg',
    colors: [
      { name: 'Vert', hex: '#A8C4A8' },
      { name: 'Prune', hex: '#9B7A96' },
      { name: 'Rose', hex: '#F2C6D4' },
    ],
    colorImages: {
      Vert: '/products/sais-08.jpg',
      Prune: '/products/sais-09.jpg',
      Rose: '/products/sais-14.jpg',
    },
    sizes: ['M', 'L', 'XL', 'XXL'],
    fabric: 'Tissu hiver côtelé',
    features: ['Col zippé', 'Poche poitrine', 'Poignets côtes'],
    categoryName: 'Ensembles Hiver',
    slugCategory: 'ensembles',
    description: 'Ensemble col zippé en tissu d\'hiver côtelé, poche poitrine et poignets côtes. Confort et chaleur toute la journée.',
  },
  {
    id: 'p8',
    title: 'Pyjama Fleur Cardigan',
    slug: 'pyjama-fleur-cardigan-mauve',
    price: 259,
    originalPrice: 299,
    imageUrl: '/products/sais-11.jpg',
    colors: [
      { name: 'Mauve', hex: '#C9B8D4' },
      { name: 'Sauge', hex: '#A8C4A8' },
      { name: 'Prune', hex: '#9B7A96' },
    ],
    colorImages: {
      Mauve: '/products/sais-11.jpg',
      Sauge: '/products/sais-12.jpg',
      Prune: '/products/sais-16.jpg',
    },
    sizes: ['M', 'L', 'XL', 'XXL'],
    fabric: 'Polaire ultra douce',
    features: ['Bordure fausse fourrure', 'Boutons rouges', 'Nœuds satinés'],
    categoryName: 'Pyjamas Polaires',
    slugCategory: 'pyjamas',
    description: 'Cardigan polaire à fleurs embossées, bordure en fausse fourrure blanche, ultra douce.',
  },
  {
    id: 'p9',
    title: 'Pyjama Beautiful',
    slug: 'pyjama-beautiful-rose',
    price: 259,
    originalPrice: 319,
    imageUrl: '/products/sais-13.jpg',
    colors: [
      { name: 'Rose', hex: '#F2C6D4' },
      { name: 'Beige', hex: '#E8DCC8' },
      { name: 'Corail', hex: '#F2A89A' },
      { name: 'Lilas', hex: '#D4C4E0' },
    ],
    colorImages: {
      Rose: '/products/sais-13.jpg',
      Beige: '/products/sais-15.jpg',
      Corail: '/products/sais-20.jpg',
      Lilas: '/products/sais-23.jpg',
    },
    sizes: ['M', 'L', 'XL', 'XXL'],
    fabric: 'Velours embossé',
    features: ['Broderie « Beautiful »', 'Poches à dentelle noire', 'Ultra doux'],
    categoryName: 'Pyjamas Polaires',
    slugCategory: 'pyjamas',
    badge: 'Populaire',
    description: 'Pyjama chemise avec broderie florale et poches à dentelle noire. Doux, léger et élégant à la maison.',
  },
  {
    id: 'p10',
    title: 'Ensemble Lovely Ours',
    slug: 'ensemble-lovely-ours-rose',
    price: 299,
    imageUrl: '/products/sais-17.jpg',
    colors: [
      { name: 'Rose', hex: '#F2C6D4' },
      { name: 'Beige', hex: '#E8DCC8' },
      { name: 'Rouge', hex: '#D85A5A' },
      { name: 'Mauve', hex: '#C9B8D4' },
      { name: 'Sauge', hex: '#A8C4A8' },
    ],
    colorImages: {
      Rose: '/products/sais-17.jpg',
      Beige: '/products/sais-18.jpg',
      Rouge: '/products/sais-19.jpg',
      Mauve: '/products/sais-21.jpg',
      Sauge: '/products/sais-22.jpg',
    },
    sizes: ['M', 'L', 'XL', 'XXL'],
    fabric: 'Maille torsadée ultra douce',
    features: ['Écusson ourson brodé', 'Nœud rouge', 'Coupe cocooning'],
    categoryName: 'Ensembles Hiver',
    slugCategory: 'ensembles',
    badge: 'Populaire',
    description: 'Ensemble en maille torsadée avec ourson brodé et nœud rouge. Chaud, confortable et très doux.',
  },
  {
    id: 'p11',
    title: 'Pyjama Velours Tie & Dye',
    slug: 'pyjama-velours-tie-dye',
    price: 299,
    originalPrice: 349,
    imageUrl: '/products/sais-24.jpg',
    colors: [
      { name: 'Bordeaux', hex: '#8B3A4A' },
      { name: 'Camel', hex: '#C4A87A' },
      { name: 'Marine', hex: '#3A4A6B' },
      { name: 'Bleu', hex: '#A8C5D8' },
    ],
    colorImages: {
      Bordeaux: '/products/sais-24.jpg',
      Camel: '/products/pyjama-velours-tie-dye/1.jpg',
      Marine: '/products/pyjama-velours-tie-dye/2.jpg',
      Bleu: '/products/pyjama-velours-tie-dye/4.jpg',
    },
    sizes: ['M', 'L', 'XL', 'XXL'],
    fabric: 'Velours côtelé doux',
    features: ['Impression tie & dye', 'Col et poches à volants', '4 coloris'],
    categoryName: 'Ensembles Hiver',
    slugCategory: 'ensembles',
    badge: 'Nouveau',
    description: 'Pyjama deux pièces en velours côtelé doux : veste à impression tie & dye, col et poches à volants assortis. Chaud, confortable, parfait pour la maison.',
  },
]

export const categories: Category[] = [
  {
    name: 'Toutes',
    slug: 'all',
    count: `${PRODUCTS_SEED.length} pièces`,
    imageUrl: '/products/sais-01.jpg',
  },
  {
    name: 'Peignoirs',
    slug: 'peignoirs',
    count: `${PRODUCTS_SEED.filter((p) => p.slugCategory === 'peignoirs').length} pièces`,
    imageUrl: '/products/sais-04.jpg',
  },
  {
    name: 'Pyjamas Polaires',
    slug: 'pyjamas',
    count: `${PRODUCTS_SEED.filter((p) => p.slugCategory === 'pyjamas').length} pièces`,
    imageUrl: '/products/sais-13.jpg',
  },
  {
    name: 'Ensembles Hiver',
    slug: 'ensembles',
    count: `${PRODUCTS_SEED.filter((p) => p.slugCategory === 'ensembles').length} pièces`,
    imageUrl: '/products/sais-17.jpg',
  },
]

export function getProduct(slug: string) {
  return PRODUCTS_SEED.find((p) => p.slug === slug)
}

/**
 * Slugs that resolve to a collection. "nouveautes" is a virtual collection —
 * it is not a family, so it never appears in the category rail.
 */
export const COLLECTION_SLUGS = ['all', 'peignoirs', 'pyjamas', 'ensembles', 'nouveautes']

export function getProductsByCategory(slug: string) {
  if (slug === 'all') return PRODUCTS_SEED
  if (slug === 'nouveautes') return PRODUCTS_SEED.filter((p) => Boolean(p.badge))
  return PRODUCTS_SEED.filter((p) => p.slugCategory === slug)
}

/** Discount percentage for a product on sale, 0 when it is not. */
export function discountPercent(product: Product) {
  if (!product.originalPrice || product.originalPrice <= product.price) return 0
  return Math.round(
    ((product.originalPrice - product.price) / product.originalPrice) * 100
  )
}

/** Products currently on promotion, deepest discount first. */
export function getPromoProducts() {
  return PRODUCTS_SEED
    .filter((p) => discountPercent(p) > 0)
    .sort((a, b) => discountPercent(b) - discountPercent(a))
}

/** Backwards-compatible alias for the seed catalogue (static fallback). */
export { PRODUCTS_SEED as products }
