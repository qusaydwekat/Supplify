import 'server-only'

import { getSupplierInventoryInsightsPaged } from '@/lib/data/inventory-insights'
import type { InventoryInsightRow } from '@/lib/data/inventory-insights'

export async function getProductActivityInsights(
  productId: string,
): Promise<{ rows: InventoryInsightRow[]; currencyCode: string; error?: string }> {
  const res = await getSupplierInventoryInsightsPaged({ page: 1, pageSize: 200, filter: 'all' })
  if ('error' in res) return { rows: [], currencyCode: 'USD', error: res.error }
  const rows = res.rows.filter((r) => r.productId === productId)
  return { rows, currencyCode: res.currencyCode }
}
