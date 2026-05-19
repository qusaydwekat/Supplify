import { requireRequestUserId } from '@/lib/auth/request-session'
import { supabaseServer } from '@/lib/supabase/server'
import { clampPageToTotal, totalPagesFromCount } from '@/lib/data/pagination'

export type InventoryInsightFilter = 'all' | 'reorder' | 'low_stock' | 'no_sales' | 'active'

export type InventoryInsightRow = {
  variationId: string
  productId: string
  productName: string
  variationLabel: string | null
  stock: number
  costPrice: number
  minOrderQuantity: number
  unitsSold30d: number
  lastSaleAt: string | null
  valuationLine: number
  dailyVelocity: number
  coverDays: number | null
  isReorderCandidate: boolean
  isLowStock: boolean
  isActiveSku: boolean
}

type InsightsRpcRow = {
  variation_id: string
  product_id: string
  product_name: string
  variation_label: string | null
  stock: string | number
  cost_price: string | number
  min_order_quantity: string | number
  units_sold_30d: string | number
  last_sale_at: string | null
  valuation_line: string | number
  daily_velocity: string | number
  cover_days: string | number | null
  is_reorder_candidate: boolean
  is_low_stock: boolean
  is_active_sku: boolean
  total_valuation_snapshot: string | number
  reorder_flagged_count: string | number
  low_stock_count: string | number
  total_count: string | number
}

function parseFilter(v: string | undefined): InventoryInsightFilter {
  if (v === 'reorder' || v === 'low_stock' || v === 'no_sales' || v === 'active') return v
  return 'all'
}

function mapRow(r: InsightsRpcRow): InventoryInsightRow {
  return {
    variationId: String(r.variation_id),
    productId: String(r.product_id),
    productName: String(r.product_name ?? '—'),
    variationLabel: r.variation_label == null ? null : String(r.variation_label),
    stock: Number(r.stock ?? 0),
    costPrice: Number(r.cost_price ?? 0),
    minOrderQuantity: Number(r.min_order_quantity ?? 1),
    unitsSold30d: Number(r.units_sold_30d ?? 0),
    lastSaleAt: r.last_sale_at == null ? null : String(r.last_sale_at),
    valuationLine: Number(r.valuation_line ?? 0),
    dailyVelocity: Number(r.daily_velocity ?? 0),
    coverDays: r.cover_days == null ? null : Number(r.cover_days),
    isReorderCandidate: Boolean(r.is_reorder_candidate),
    isLowStock: Boolean(r.is_low_stock),
    isActiveSku: Boolean(r.is_active_sku),
  }
}

function snapshotFromRow(r: InsightsRpcRow | undefined) {
  return {
    totalValuation: Number(r?.total_valuation_snapshot ?? 0),
    reorderFlaggedCount: Number(r?.reorder_flagged_count ?? 0),
    lowStockCount: Number(r?.low_stock_count ?? 0),
  }
}

export async function getSupplierInventoryInsightsPaged(opts: {
  page: number
  pageSize: number
  filter?: string
}): Promise<
  | {
      rows: InventoryInsightRow[]
      totalValuation: number
      reorderFlaggedCount: number
      lowStockCount: number
      currencyCode: string
      totalCount: number
      totalPages: number
      effectivePage: number
      pageSize: number
      filter: InventoryInsightFilter
    }
  | { error: string }
> {
  const filter = parseFilter(opts.filter)
  const userId = await requireRequestUserId()
  const supabase = supabaseServer()
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id, currency_code')
    .eq('user_id', userId)
    .maybeSingle()
  if (!supplier) return { error: 'Not a supplier' }

  const currencyCode = String((supplier as { currency_code?: string }).currency_code ?? 'USD')
  const pageSize = opts.pageSize
  let effectivePage = opts.page

  const run = (offset: number, f: InventoryInsightFilter) =>
    supabase.rpc('supplier_inventory_insights_paged', {
      p_limit: pageSize,
      p_offset: offset,
      p_filter: f,
    })

  let { data, error } = await run((effectivePage - 1) * pageSize, filter)
  if (error) return { error: error.message }

  let raw = (data ?? []) as InsightsRpcRow[]
  let totalCount = raw.length ? Number(raw[0]?.total_count ?? 0) : 0
  const totalPages = totalPagesFromCount(totalCount, pageSize)
  effectivePage = clampPageToTotal(opts.page, totalPages)
  if (effectivePage !== opts.page && totalCount > 0) {
    const r2 = await run((effectivePage - 1) * pageSize, filter)
    if (r2.error) return { error: r2.error.message }
    raw = (r2.data ?? []) as InsightsRpcRow[]
  }

  let snap = raw[0]
  if (!snap) {
    const summaryRes = await run(0, 'all')
    if (!summaryRes.error && summaryRes.data?.length) {
      snap = (summaryRes.data as InsightsRpcRow[])[0]
    }
  }

  const { totalValuation, reorderFlaggedCount, lowStockCount } = snapshotFromRow(snap)
  const rows = raw.map(mapRow)

  return {
    rows,
    totalValuation,
    reorderFlaggedCount,
    lowStockCount,
    currencyCode,
    totalCount,
    totalPages,
    effectivePage,
    pageSize,
    filter,
  }
}
