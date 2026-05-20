import 'server-only'

import { supabaseServer } from '@/lib/supabase/server'

export type CatalogAlertStats = {
  lowStockSkus: number
  draftProducts: number
  unpublishedActive: number
}

export async function getSupplierCatalogAlertStats(): Promise<
  { stats: CatalogAlertStats; error?: string }
> {
  const supabase = supabaseServer()
  const { data, error } = await supabase.rpc('supplier_catalog_alert_stats')

  if (error) {
    return {
      stats: { lowStockSkus: 0, draftProducts: 0, unpublishedActive: 0 },
      error: error.message,
    }
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        low_stock_skus: number
        draft_products: number
        unpublished_active: number
      }
    | undefined

  return {
    stats: {
      lowStockSkus: Number(row?.low_stock_skus ?? 0),
      draftProducts: Number(row?.draft_products ?? 0),
      unpublishedActive: Number(row?.unpublished_active ?? 0),
    },
  }
}
