export type PriceTier = {
  minQuantity: number
  unitPrice: number
}

/** Pick the best tier for qty; fallback to base list price. */
export function resolveUnitPrice(basePrice: number, tiers: PriceTier[], quantity: number): number {
  const qty = Math.max(1, Math.trunc(quantity))
  const sorted = [...tiers].sort((a, b) => b.minQuantity - a.minQuantity)
  for (const tier of sorted) {
    if (qty >= tier.minQuantity) return tier.unitPrice
  }
  return basePrice
}

export function normalizePriceTiers(
  rows: { min_quantity: number; unit_price: number }[],
): PriceTier[] {
  return rows
    .map((r) => ({
      minQuantity: Number(r.min_quantity),
      unitPrice: Number(r.unit_price),
    }))
    .filter((t) => t.minQuantity >= 1 && Number.isFinite(t.unitPrice))
    .sort((a, b) => a.minQuantity - b.minQuantity)
}

export function tiersByVariationId(
  rows: { variation_id: string; min_quantity: number; unit_price: number }[],
): Map<string, PriceTier[]> {
  const map = new Map<string, PriceTier[]>()
  for (const row of rows) {
    const list = map.get(row.variation_id) ?? []
    list.push({ minQuantity: Number(row.min_quantity), unitPrice: Number(row.unit_price) })
    map.set(row.variation_id, list)
  }
  for (const [id, tiers] of map) {
    map.set(
      id,
      tiers.sort((a, b) => a.minQuantity - b.minQuantity),
    )
  }
  return map
}
