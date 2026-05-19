import { getLocale } from 'next-intl/server'
import { supabaseServer } from '@/lib/supabase/server'
import { formatMonthYear, normalizeAppLocale } from '@/lib/format-datetime'

const FULFILLED: readonly string[] = ['accepted', 'preparing', 'shipped', 'delivered']

export type ProfitSummary = {
  grossRevenue: number
  totalCost: number
  grossProfit: number
  profitMarginPct: number
  totalOperatingExpenses: number
  netProfit: number
}

export type MonthlyProfitPoint = {
  key: string
  label: string
  revenue: number
  cost: number
  profit: number
  profitMarginPct: number
}

export type ProductProfitRow = {
  productId: string
  productName: string
  variationId: string
  variationName: string
  sku: string | null
  unitsSold: number
  totalRevenue: number
  totalCost: number
  totalProfit: number
  profitMarginPct: number
}

export type LowMarginVariationRow = {
  productId: string
  productName: string
  variationId: string
  variationName: string
  sku: string | null
  costPrice: number
  sellingPrice: number
  currentMarginPct: number
}

export type SupplierProfitReport = {
  currencyCode: string
  summary: ProfitSummary
  monthly: MonthlyProfitPoint[]
  products: ProductProfitRow[]
  lowMargin: LowMarginVariationRow[]
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export async function getSupplierProfitReport(): Promise<{ data: SupplierProfitReport } | { error: string }> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id, currency_code')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!supplier) return { error: 'Not a supplier' }

  const appLocale = normalizeAppLocale(await getLocale())
  const monthLabel = (d: Date) => formatMonthYear(d, appLocale)

  const sid = supplier.id
  const currencyCode = String((supplier as { currency_code?: string }).currency_code ?? 'USD')

  const { data: expenseRows } = await supabase.from('expenses').select('amount').eq('supplier_id', sid)
  const totalOperatingExpenses = round2(
    (expenseRows ?? []).reduce((s, r) => s + Number((r as { amount?: number }).amount ?? 0), 0),
  )

  const emptySummary = (): ProfitSummary => ({
    grossRevenue: 0,
    totalCost: 0,
    grossProfit: 0,
    profitMarginPct: 0,
    totalOperatingExpenses,
    netProfit: round2(0 - totalOperatingExpenses),
  })

  const { data: orders, error: oErr } = await supabase
    .from('orders')
    .select('id, created_at, status')
    .eq('supplier_id', sid)
    .in('status', [...FULFILLED])

  if (oErr) return { error: oErr.message }
  const orderList = orders ?? []
  const orderMeta = new Map(orderList.map((o) => [o.id, { created_at: o.created_at as string }]))

  if (!orderList.length) {
    return {
      data: {
        currencyCode,
        summary: emptySummary(),
        monthly: [],
        products: [],
        lowMargin: [],
      },
    }
  }

  const orderIds = orderList.map((o) => o.id)
  const { data: lines, error: lErr } = await supabase
    .from('order_items')
    .select(
      'product_id, variation_id, product_name, variation_name, quantity, unit_price, unit_cost_price, total_price, total_profit, order_id',
    )
    .in('order_id', orderIds)

  if (lErr) return { error: lErr.message }
  const items = lines ?? []

  const variationIds = [...new Set(items.map((i) => i.variation_id).filter(Boolean))] as string[]
  const catalogCostByVariation = new Map<string, number>()
  if (variationIds.length > 0) {
    const { data: costRows, error: cErr } = await supabase
      .from('product_variations')
      .select('id, cost_price')
      .in('id', variationIds)
    if (cErr) return { error: cErr.message }
    for (const v of costRows ?? []) {
      catalogCostByVariation.set(v.id as string, Number((v as { cost_price?: number }).cost_price ?? 0))
    }
  }

  let grossRevenue = 0
  let totalCost = 0
  let grossProfit = 0

  const monthAgg = new Map<string, { revenue: number; cost: number; profit: number }>()
  const productAgg = new Map<
    string,
    {
      productId: string
      productName: string
      variationId: string
      variationName: string
      sku: string | null
      unitsSold: number
      totalRevenue: number
      totalCost: number
      totalProfit: number
    }
  >()

  for (const row of items) {
    const oid = row.order_id as string
    const meta = orderMeta.get(oid)
    if (!meta) continue

    const qty = Number(row.quantity)
    const unitPrice = Number(row.unit_price)
    const snapshotCost = Number(row.unit_cost_price ?? 0)
    const variationId = row.variation_id as string | null
    const catalogCost = variationId ? (catalogCostByVariation.get(variationId) ?? 0) : 0
    // Snapshot at acceptance is source of truth when set; if it stayed 0, use current catalog cost for reporting.
    const effectiveUnitCost = snapshotCost > 0 ? snapshotCost : catalogCost
    const lineRevenue = Number(row.total_price ?? qty * unitPrice)
    const lineCost = qty * effectiveUnitCost
    const lineProfit =
      snapshotCost > 0
        ? row.total_profit != null
          ? Number(row.total_profit)
          : qty * (unitPrice - snapshotCost)
        : lineRevenue - lineCost

    grossRevenue += lineRevenue
    totalCost += lineCost
    grossProfit += lineProfit

    const created = new Date(meta.created_at)
    const mk = monthKey(created)
    const bucket = monthAgg.get(mk) ?? { revenue: 0, cost: 0, profit: 0 }
    bucket.revenue += lineRevenue
    bucket.cost += lineCost
    bucket.profit += lineProfit
    monthAgg.set(mk, bucket)

    const aggVariationKey = variationId ?? `n:${row.product_id}`
    const pkey = `${row.product_id}:${aggVariationKey}`
    const existing = productAgg.get(pkey)
    const variationName = (row.variation_name as string | null) ?? '—'
    const productName = row.product_name as string

    if (existing) {
      existing.unitsSold += qty
      existing.totalRevenue += lineRevenue
      existing.totalCost += lineCost
      existing.totalProfit += lineProfit
    } else {
      productAgg.set(pkey, {
        productId: row.product_id as string,
        productName,
        variationId: variationId ?? '',
        variationName,
        sku: null,
        unitsSold: qty,
        totalRevenue: lineRevenue,
        totalCost: lineCost,
        totalProfit: lineProfit,
      })
    }
  }

  grossRevenue = round2(grossRevenue)
  totalCost = round2(totalCost)
  grossProfit = round2(grossProfit)
  const profitMarginPct = grossRevenue > 0 ? round2((grossProfit / grossRevenue) * 100) : 0
  const netProfit = round2(grossProfit - totalOperatingExpenses)

  const monthlyKeys = [...monthAgg.keys()].sort()
  const monthly: MonthlyProfitPoint[] = monthlyKeys.map((key) => {
    const [y, m] = key.split('-').map(Number)
    const d = new Date(y, m - 1, 1)
    const b = monthAgg.get(key)!
    const rev = round2(b.revenue)
    const cost = round2(b.cost)
    const profit = round2(b.profit)
    const marginPct = rev > 0 ? round2((profit / rev) * 100) : 0
    return {
      key,
      label: monthLabel(d),
      revenue: rev,
      cost,
      profit,
      profitMarginPct: marginPct,
    }
  })

  const products: ProductProfitRow[] = [...productAgg.values()]
    .map((p) => {
      const profitMarginPct = p.totalRevenue > 0 ? round2((p.totalProfit / p.totalRevenue) * 100) : 0
      return {
        productId: p.productId,
        productName: p.productName,
        variationId: p.variationId,
        variationName: p.variationName,
        sku: p.sku,
        unitsSold: p.unitsSold,
        totalRevenue: round2(p.totalRevenue),
        totalCost: round2(p.totalCost),
        totalProfit: round2(p.totalProfit),
        profitMarginPct,
      }
    })
    .sort((a, b) => b.totalProfit - a.totalProfit)

  const { data: productsMeta } = await supabase.from('products').select('id, name').eq('supplier_id', sid)
  const nameByProduct = new Map((productsMeta ?? []).map((p) => [p.id as string, p.name as string]))

  const productIdList = [...new Set((productsMeta ?? []).map((p) => p.id as string))]
  const { data: varRows } =
    productIdList.length > 0
      ? await supabase
          .from('product_variations')
          .select('id, name, sku, cost_price, price, product_id, is_active')
          .in('product_id', productIdList)
      : { data: [] as Record<string, unknown>[] }

  const skuByVariation = new Map<string, string | null>()
  const lowMargin: LowMarginVariationRow[] = []
  for (const v of varRows ?? []) {
    const price = Number(v.price)
    const cost = Number(v.cost_price ?? 0)
    skuByVariation.set(v.id as string, (v.sku as string | null) ?? null)
    if (!v.is_active || price <= 0) continue
    const marginPct = round2(((price - cost) / price) * 100)
    if (marginPct < 15) {
      const pid = v.product_id as string
      lowMargin.push({
        productId: pid,
        productName: nameByProduct.get(pid) ?? '—',
        variationId: v.id as string,
        variationName: (v.name as string) ?? '—',
        sku: (v.sku as string | null) ?? null,
        costPrice: round2(cost),
        sellingPrice: round2(price),
        currentMarginPct: marginPct,
      })
    }
  }

  lowMargin.sort((a, b) => a.currentMarginPct - b.currentMarginPct)

  for (const p of products) {
    if (p.variationId && skuByVariation.has(p.variationId)) {
      p.sku = skuByVariation.get(p.variationId) ?? null
    }
  }

  return {
    data: {
      currencyCode,
      summary: {
        grossRevenue,
        totalCost,
        grossProfit,
        profitMarginPct,
        totalOperatingExpenses,
        netProfit,
      },
      monthly,
      products,
      lowMargin,
    },
  }
}
