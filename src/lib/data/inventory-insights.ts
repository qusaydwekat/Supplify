import { supabaseServer } from '@/lib/supabase/server'
import { clampPageToTotal, totalPagesFromCount } from '@/lib/data/pagination'

export type InventoryInsightRow = {
  variationId: string
  productName: string
  variationLabel: string | null
  stock: number
  costPrice: number
  unitsSold30d: number
  lastSaleAt: string | null
  valuationLine: number
  dailyVelocity: number
  /** Rough days of cover at recent velocity; null if no sales. */
  coverDays: number | null
}

type InsightsRpcRow = {
  variation_id: string
  product_name: string
  variation_label: string | null
  stock: string | number
  cost_price: string | number
  units_sold_30d: string | number
  last_sale_at: string | null
  valuation_line: string | number
  daily_velocity: string | number
  cover_days: string | number | null
  total_valuation_snapshot: string | number
  reorder_flagged_count: string | number
  total_count: string | number
}

export async function getSupplierInventoryInsightsPaged(opts: {
  page: number
  pageSize: number
}): Promise<
  | {
      rows: InventoryInsightRow[]
      totalValuation: number
      reorderFlaggedCount: number
      currencyCode: string
      totalCount: number
      totalPages: number
      effectivePage: number
      pageSize: number
    }
  | { error: string }
> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: supplier } = await supabase.from('suppliers').select('id, currency_code').eq('user_id', user.id).maybeSingle()
  if (!supplier) return { error: 'Not a supplier' }

  const currencyCode = String((supplier as { currency_code?: string }).currency_code ?? 'USD')
  const pageSize = opts.pageSize
  let effectivePage = opts.page

  const run = (offset: number) =>
    supabase.rpc('supplier_inventory_insights_paged', {
      p_limit: pageSize,
      p_offset: offset,
    })

  let { data, error } = await run((effectivePage - 1) * pageSize)
  if (error) return { error: error.message }

  let raw = (data ?? []) as InsightsRpcRow[]
  const totalCount = raw.length ? Number(raw[0]?.total_count ?? 0) : 0
  const totalPages = totalPagesFromCount(totalCount, pageSize)
  effectivePage = clampPageToTotal(opts.page, totalPages)
  if (effectivePage !== opts.page && totalCount > 0) {
    const r2 = await run((effectivePage - 1) * pageSize)
    if (r2.error) return { error: r2.error.message }
    raw = (r2.data ?? []) as InsightsRpcRow[]
  }

  const snap = raw[0]
  const rows: InventoryInsightRow[] = raw.map((r) => ({
    variationId: String(r.variation_id),
    productName: String(r.product_name ?? '—'),
    variationLabel: r.variation_label == null ? null : String(r.variation_label),
    stock: Number(r.stock ?? 0),
    costPrice: Number(r.cost_price ?? 0),
    unitsSold30d: Number(r.units_sold_30d ?? 0),
    lastSaleAt: r.last_sale_at == null ? null : String(r.last_sale_at),
    valuationLine: Number(r.valuation_line ?? 0),
    dailyVelocity: Number(r.daily_velocity ?? 0),
    coverDays: r.cover_days == null ? null : Number(r.cover_days),
  }))

  return {
    rows,
    totalValuation: Number(snap?.total_valuation_snapshot ?? 0),
    reorderFlaggedCount: Number(snap?.reorder_flagged_count ?? 0),
    currencyCode,
    totalCount,
    totalPages,
    effectivePage,
    pageSize,
  }
}
