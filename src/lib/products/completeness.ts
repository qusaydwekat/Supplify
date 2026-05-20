import type { ProductCatalogStatus } from '@/lib/types/products'

export type CompletenessCheckInput = {
  name: string
  description: string | null
  marketplaceCategory: string | null
  imageUrl: string | null
  galleryCount: number
  catalogStatus: ProductCatalogStatus
  variations: {
    sku: string | null
    price: number
    stock_quantity: number
    is_active: boolean
  }[]
}

export type CompletenessResult = {
  score: number
  missingKeys: string[]
}

const CHECKS: {
  key: string
  weight: number
  pass: (input: CompletenessCheckInput) => boolean
}[] = [
  { key: 'name', weight: 10, pass: (i) => i.name.trim().length >= 2 },
  {
    key: 'description',
    weight: 15,
    pass: (i) => (i.description?.trim().length ?? 0) >= 20,
  },
  { key: 'category', weight: 15, pass: (i) => !!i.marketplaceCategory },
  {
    key: 'image',
    weight: 20,
    pass: (i) => !!(i.imageUrl?.trim() || i.galleryCount > 0),
  },
  {
    key: 'activeSku',
    weight: 20,
    pass: (i) => i.variations.some((v) => v.is_active && v.price > 0),
  },
  {
    key: 'sku',
    weight: 10,
    pass: (i) => i.variations.some((v) => !!(v.sku?.trim())),
  },
  {
    key: 'stock',
    weight: 10,
    pass: (i) => i.variations.some((v) => v.is_active && v.stock_quantity > 0),
  },
]

export function calcProductCompleteness(input: CompletenessCheckInput): CompletenessResult {
  let earned = 0
  const total = CHECKS.reduce((s, c) => s + c.weight, 0)
  const missingKeys: string[] = []

  for (const check of CHECKS) {
    if (check.pass(input)) earned += check.weight
    else missingKeys.push(check.key)
  }

  const score = Math.round((earned / total) * 100)
  return { score, missingKeys }
}

export function completenessTone(score: number): 'low' | 'mid' | 'high' {
  if (score >= 85) return 'high'
  if (score >= 55) return 'mid'
  return 'low'
}
