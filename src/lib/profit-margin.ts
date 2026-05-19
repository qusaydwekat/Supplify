/** Profit margin math shared by product forms and analytics UI. */

export function roundProfitPct(n: number) {
  return Math.round(n * 100) / 100
}

export function calculateProfitMarginPct(cost: number, price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0
  return roundProfitPct(((price - cost) / price) * 100)
}

export function calculateProfitPerUnit(cost: number, price: number): number {
  return roundProfitPct(price - cost)
}

export type ProfitMarginTier = 'emerald' | 'green' | 'amber' | 'red'

export function getProfitMarginTier(pct: number): ProfitMarginTier {
  if (pct >= 40) return 'emerald'
  if (pct >= 20) return 'green'
  if (pct >= 10) return 'amber'
  return 'red'
}

/** Tailwind classes for margin badge (matches product-profit-table). */
export function marginBadgeClass(pct: number): string {
  const tier = getProfitMarginTier(pct)
  switch (tier) {
    case 'emerald':
      return 'bg-emerald-100 text-emerald-800'
    case 'green':
      return 'bg-green-100 text-green-700'
    case 'amber':
      return 'bg-amber-100 text-amber-800'
    default:
      return 'bg-red-100 text-red-800'
  }
}
