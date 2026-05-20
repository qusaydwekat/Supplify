/** Margin helpers for product SKU pricing UI. */

export function calcMarginPercent(price: number, cost: number): number | null {
  if (!Number.isFinite(price) || price <= 0) return null
  const c = Number.isFinite(cost) ? cost : 0
  return ((price - c) / price) * 100
}

export function calcMarkupPercent(price: number, cost: number): number | null {
  const c = Number.isFinite(cost) ? cost : 0
  if (c <= 0) return null
  if (!Number.isFinite(price)) return null
  return ((price - c) / c) * 100
}

export function isNegativeMargin(price: number, cost: number): boolean {
  return Number.isFinite(price) && Number.isFinite(cost) && price < cost
}

export function formatMarginPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(1)}%`
}
