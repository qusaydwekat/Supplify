import 'server-only'

import { supabaseServer } from '@/lib/supabase/server'
import { normalizePriceTiers, resolveUnitPrice, tiersByVariationId, type PriceTier } from '@/lib/pricing/resolve-unit-price'

export type { PriceTier }

export async function listPriceTiersForVariations(
  variationIds: string[],
): Promise<Map<string, PriceTier[]>> {
  if (!variationIds.length) return new Map()

  const supabase = supabaseServer()
  const { data, error } = await supabase
    .from('variation_price_tiers')
    .select('variation_id, min_quantity, unit_price')
    .in('variation_id', variationIds)
    .order('min_quantity', { ascending: true })

  if (error || !data?.length) return new Map()
  return tiersByVariationId(data)
}

export async function listPriceTiersForVariation(variationId: string): Promise<PriceTier[]> {
  const map = await listPriceTiersForVariations([variationId])
  return map.get(variationId) ?? []
}

export async function resolveVariationUnitPriceServer(
  variationId: string,
  basePrice: number,
  quantity: number,
  tiers?: PriceTier[],
): Promise<number> {
  const tierList = tiers ?? (await listPriceTiersForVariation(variationId))
  return resolveUnitPrice(basePrice, tierList, quantity)
}

export async function resolveManyVariationPrices(
  items: { variationId: string; basePrice: number; quantity: number }[],
): Promise<Map<string, number>> {
  const ids = [...new Set(items.map((i) => i.variationId))]
  const tierMap = await listPriceTiersForVariations(ids)
  const out = new Map<string, number>()
  for (const item of items) {
    const tiers = tierMap.get(item.variationId) ?? []
    out.set(`${item.variationId}:${item.quantity}`, resolveUnitPrice(item.basePrice, tiers, item.quantity))
  }
  return out
}

export { normalizePriceTiers, resolveUnitPrice, tiersByVariationId }
