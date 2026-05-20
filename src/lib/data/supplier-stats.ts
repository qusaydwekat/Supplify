import { supabaseServer } from '@/lib/supabase/server'
import type { OrderStatus } from '@/lib/validations/order'
import { orderRowsNewestFirst } from '@/lib/data/order-sort'

export type RecentOrderRow = {
  id: string
  retailerName: string
  total: number
  status: string
  createdAt: string
}

export type MiniRevenuePt = { label: string; invoiced: number; collected: number }

export type SupplierDashboardStats = {
  pendingOrders: number
  preparingOrders: number
  deliveredOrders: number
  /** Delivered orders that do not yet have an invoice (same logic as new-invoice picker). */
  deliveredUninvoicedCount: number
  totalOrders: number
  lowStockVariations: number
  outstandingBalance: number
  totalInvoiced: number
  totalCollected: number
  currencyCode: string
  ordersByStatus: Partial<Record<OrderStatus, number>>
  recentOrders: RecentOrderRow[]
  monthlyMini: MiniRevenuePt[]
  avgRating: number | null
  reviewCount: number
}

export type SupplierReportStats = {
  pendingOrders: number
  preparingOrders: number
  lowStockVariations: number
  outstandingBalance: number
  totalInvoiced: number
  totalCollected: number
  currencyCode: string
  ordersByStatus: Partial<Record<OrderStatus, number>>
  retailerRows: { retailerLabel: string; balance: number }[]
}

const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'accepted',
  'modified',
  'rejected',
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
]

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export async function getSupplierDashboardStats(): Promise<{ stats: SupplierDashboardStats } | { error: string }> {
  const supabase = supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id, currency_code, avg_rating, review_count')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!supplier) return { error: 'Not a supplier' }

  const sid = supplier.id
  const currencyCode = String((supplier as { currency_code?: string }).currency_code ?? 'USD')

  const { data: orders } = await orderRowsNewestFirst(
    supabase.from('orders').select('id, status, total_price, created_at, retailer_id').eq('supplier_id', sid),
  )

  const ordersByStatus: Partial<Record<OrderStatus, number>> = {}
  for (const st of ORDER_STATUSES) ordersByStatus[st] = 0
  for (const row of orders ?? []) {
    const st = row.status as OrderStatus
    ordersByStatus[st] = (ordersByStatus[st] ?? 0) + 1
  }

  const pendingOrders = ordersByStatus.pending ?? 0
  const preparingOrders = (ordersByStatus.preparing ?? 0) + (ordersByStatus.shipped ?? 0)
  const deliveredOrders = ordersByStatus.delivered ?? 0
  const totalOrders = (orders ?? []).length

  const { data: invoiceOrderRows } = await supabase.from('invoices').select('order_id').eq('supplier_id', sid)
  const invoicedOrderIds = new Set(
    (invoiceOrderRows ?? []).map((r) => r.order_id).filter((id): id is string => Boolean(id)),
  )
  let deliveredUninvoicedCount = 0
  for (const o of orders ?? []) {
    if (o.status === 'delivered' && !invoicedOrderIds.has(o.id)) deliveredUninvoicedCount += 1
  }

  const { data: products } = await supabase.from('products').select('id').eq('supplier_id', sid)
  const productIds = (products ?? []).map((p) => p.id)
  let lowStockVariations = 0
  const { data: lowStockRpc } = await supabase.rpc('supplier_low_stock_sku_count')
  if (lowStockRpc != null) {
    lowStockVariations = Number(lowStockRpc)
  } else if (productIds.length) {
    const { count } = await supabase
      .from('product_variations')
      .select('*', { count: 'exact', head: true })
      .in('product_id', productIds)
      .lt('stock_quantity', 10)
    lowStockVariations = count ?? 0
  }

  const { data: ledgerRows } = await supabase
    .from('ledger_entries')
    .select('retailer_id, type, amount, created_at')
    .eq('supplier_id', sid)

  let totalInvoiced = 0
  let totalCollected = 0
  let outstandingBalance = 0

  const now = new Date()
  const seriesStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const miniMap = new Map<string, { invoiced: number; collected: number }>()
  for (let i = 0; i < 6; i++) {
    const d = new Date(seriesStart.getFullYear(), seriesStart.getMonth() + i, 1)
    miniMap.set(monthKey(d), { invoiced: 0, collected: 0 })
  }

  for (const row of ledgerRows ?? []) {
    const amt = Number(row.amount)
    outstandingBalance += amt
    if (row.type === 'invoice' || row.type === 'debit_note') totalInvoiced += amt
    if (row.type === 'payment' || row.type === 'credit_note') totalCollected += -amt

    const d = new Date(row.created_at)
    const k = monthKey(d)
    const bucket = miniMap.get(k)
    if (bucket) {
      if (row.type === 'invoice' || row.type === 'debit_note') bucket.invoiced += amt
      if (row.type === 'payment' || row.type === 'credit_note') bucket.collected += -amt
    }
  }

  outstandingBalance = Math.round(outstandingBalance * 100) / 100
  totalInvoiced = Math.round(totalInvoiced * 100) / 100
  totalCollected = Math.round(totalCollected * 100) / 100

  const monthlyMini: MiniRevenuePt[] = [...miniMap.entries()].map(([k, v]) => {
    const [, m] = k.split('-').map(Number)
    return {
      label: MONTH_LABELS[m - 1],
      invoiced: Math.round(v.invoiced * 100) / 100,
      collected: Math.round(v.collected * 100) / 100,
    }
  })

  const recent = (orders ?? []).slice(0, 5)

  const retailerIds = [...new Set(recent.map((o) => o.retailer_id))]
  const { data: profiles } = retailerIds.length
    ? await supabase.from('profiles').select('user_id, business_name, name').in('user_id', retailerIds)
    : { data: [] as { user_id: string; business_name: string | null; name: string | null }[] }
  const profMap = new Map((profiles ?? []).map((p) => [p.user_id, p]))

  const recentOrders: RecentOrderRow[] = recent.map((o) => {
    const p = profMap.get(o.retailer_id)
    return {
      id: o.id,
      retailerName: p?.business_name || p?.name || 'Retailer',
      total: Number(o.total_price),
      status: o.status,
      createdAt: o.created_at,
    }
  })

  return {
    stats: {
      pendingOrders,
      preparingOrders,
      deliveredOrders,
      deliveredUninvoicedCount,
      totalOrders,
      lowStockVariations,
      outstandingBalance,
      totalInvoiced,
      totalCollected,
      currencyCode,
      ordersByStatus,
      recentOrders,
      monthlyMini,
      avgRating: Number(supplier.avg_rating) || null,
      reviewCount: supplier.review_count ?? 0,
    },
  }
}

export async function getSupplierReportStats(): Promise<{ stats: SupplierReportStats } | { error: string }> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: supplier } = await supabase.from('suppliers').select('id, currency_code').eq('user_id', user.id).maybeSingle()
  if (!supplier) return { error: 'Not a supplier' }

  const sid = supplier.id
  const currencyCode = String((supplier as { currency_code?: string }).currency_code ?? 'USD')

  const { data: orders } = await supabase.from('orders').select('status').eq('supplier_id', sid)

  const ordersByStatus: Partial<Record<OrderStatus, number>> = {}
  for (const st of ORDER_STATUSES) ordersByStatus[st] = 0
  for (const row of orders ?? []) {
    const st = row.status as OrderStatus
    ordersByStatus[st] = (ordersByStatus[st] ?? 0) + 1
  }

  const pendingOrders = ordersByStatus.pending ?? 0
  const preparingOrders = (ordersByStatus.preparing ?? 0) + (ordersByStatus.shipped ?? 0)

  const { data: products } = await supabase.from('products').select('id').eq('supplier_id', sid)
  const productIds = (products ?? []).map((p) => p.id)
  let lowStockVariations = 0
  const { data: lowStockRpc } = await supabase.rpc('supplier_low_stock_sku_count')
  if (lowStockRpc != null) {
    lowStockVariations = Number(lowStockRpc)
  } else if (productIds.length) {
    const { count } = await supabase
      .from('product_variations')
      .select('*', { count: 'exact', head: true })
      .in('product_id', productIds)
      .lt('stock_quantity', 10)
    lowStockVariations = count ?? 0
  }

  const { data: ledgerRows } = await supabase
    .from('ledger_entries')
    .select('retailer_id, type, amount')
    .eq('supplier_id', sid)

  let totalInvoiced = 0
  let totalCollected = 0
  let outstandingBalance = 0
  const balanceByRetailer = new Map<string, number>()

  for (const row of ledgerRows ?? []) {
    const amt = Number(row.amount)
    outstandingBalance += amt
    if (row.type === 'invoice') totalInvoiced += amt
    if (row.type === 'payment') totalCollected += -amt
    const rid = row.retailer_id
    balanceByRetailer.set(rid, (balanceByRetailer.get(rid) ?? 0) + amt)
  }

  const retailerIds = [...balanceByRetailer.keys()]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, business_name, name')
    .in('user_id', retailerIds)

  const profMap = new Map((profiles ?? []).map((p) => [p.user_id, p]))
  const retailerRows = [...balanceByRetailer.entries()]
    .map(([rid, balance]) => {
      const p = profMap.get(rid)
      return {
        retailerLabel: p?.business_name || p?.name || 'Retailer',
        balance,
      }
    })
    .filter((r) => Math.abs(r.balance) > 0.001)
    .sort((a, b) => b.balance - a.balance)

  outstandingBalance = Math.round(outstandingBalance * 100) / 100
  totalInvoiced = Math.round(totalInvoiced * 100) / 100
  totalCollected = Math.round(totalCollected * 100) / 100

  return {
    stats: {
      pendingOrders,
      preparingOrders,
      lowStockVariations,
      outstandingBalance,
      totalInvoiced,
      totalCollected,
      currencyCode,
      ordersByStatus,
      retailerRows,
    },
  }
}
