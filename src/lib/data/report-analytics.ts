import { getLocale } from 'next-intl/server'
import { supabaseServer } from '@/lib/supabase/server'
import { formatMonthYear, normalizeAppLocale } from '@/lib/format-datetime'

export type MonthlyRevenuePoint = {
  key: string
  label: string
  invoiced: number
  collected: number
}

export type TopProductRow = {
  productName: string
  variationName: string | null
  quantitySold: number
  revenue: number
}

export type TopRetailerRow = {
  retailerLabel: string
  city: string | null
  orderCount: number
  totalInvoiced: number
  totalPaid: number
  outstanding: number
}

export type OutstandingInvoiceRow = {
  id: string
  invoice_number: string
  retailerLabel: string
  issued_at: string
  due_date: string | null
  total: number
  paid: number
  outstanding: number
  status: string
  ageBucket: 'current' | '30_60' | '60_90' | '90_plus'
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function getSupplierReportAnalytics(): Promise<
  | {
      monthly: MonthlyRevenuePoint[]
      topProducts: TopProductRow[]
      topRetailers: TopRetailerRow[]
      outstandingInvoices: OutstandingInvoiceRow[]
      ordersThisMonth: number
      activeRetailers: number
    }
  | { error: string }
> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  if (!supplier) return { error: 'Not a supplier' }

  const appLocale = normalizeAppLocale(await getLocale())
  const monthLabel = (d: Date) => formatMonthYear(d, appLocale)

  const sid = supplier.id
  const now = new Date()
  const seriesStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)

  const { data: ledgerRows } = await supabase
    .from('ledger_entries')
    .select('created_at, type, amount')
    .eq('supplier_id', sid)
    .gte('created_at', seriesStart.toISOString())

  const monthMap = new Map<string, { invoiced: number; collected: number }>()
  for (let i = 0; i < 12; i++) {
    const d = new Date(seriesStart.getFullYear(), seriesStart.getMonth() + i, 1)
    monthMap.set(monthKey(d), { invoiced: 0, collected: 0 })
  }

  for (const row of ledgerRows ?? []) {
    const d = new Date(row.created_at)
    const key = monthKey(startOfMonth(d))
    const bucket = monthMap.get(key)
    if (!bucket) continue
    const amt = Number(row.amount)
    if (row.type === 'invoice') bucket.invoiced += amt
    if (row.type === 'payment') bucket.collected += -amt
  }

  const monthly: MonthlyRevenuePoint[] = [...monthMap.entries()].map(([key, v]) => {
    const [y, m] = key.split('-').map(Number)
    const d = new Date(y, m - 1, 1)
    return {
      key,
      label: monthLabel(d),
      invoiced: Math.round(v.invoiced * 100) / 100,
      collected: Math.round(v.collected * 100) / 100,
    }
  })

  const monthStart = startOfMonth(now)
  const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1)

  const { count: ordersThisMonth } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('supplier_id', sid)
    .gte('created_at', monthStart.toISOString())
    .lt('created_at', nextMonth.toISOString())

  const { data: distinctRetailers } = await supabase.from('orders').select('retailer_id').eq('supplier_id', sid)
  const activeRetailers = new Set((distinctRetailers ?? []).map((r) => r.retailer_id)).size

  const { data: fulfilOrders } = await supabase
    .from('orders')
    .select('id')
    .eq('supplier_id', sid)
    .in('status', ['accepted', 'preparing', 'shipped', 'delivered'])

  const fulfilOrderIds = (fulfilOrders ?? []).map((o) => o.id)
  const { data: oiRows } =
    fulfilOrderIds.length > 0
      ? await supabase
          .from('order_items')
          .select('product_name, variation_name, quantity, total_price')
          .in('order_id', fulfilOrderIds)
      : { data: [] as { product_name: string; variation_name: string | null; quantity: number; total_price: number }[] }

  const productKey = (r: { product_name: string; variation_name: string | null }) =>
    `${r.product_name}||${r.variation_name ?? ''}`
  const prodAgg = new Map<string, { productName: string; variationName: string | null; qty: number; rev: number }>()
  for (const row of oiRows ?? []) {
    const k = productKey(row)
    const cur = prodAgg.get(k) ?? {
      productName: row.product_name,
      variationName: row.variation_name,
      qty: 0,
      rev: 0,
    }
    cur.qty += row.quantity
    cur.rev += Number(row.total_price)
    prodAgg.set(k, cur)
  }

  const topProducts: TopProductRow[] = [...prodAgg.values()]
    .map((v) => ({
      productName: v.productName,
      variationName: v.variationName,
      quantitySold: v.qty,
      revenue: Math.round(v.rev * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15)

  const { data: ledgerByRetailer } = await supabase
    .from('ledger_entries')
    .select('retailer_id, type, amount')
    .eq('supplier_id', sid)

  const retailerAgg = new Map<string, { invoiced: number; paid: number; net: number }>()
  for (const row of ledgerByRetailer ?? []) {
    const rid = row.retailer_id
    const cur = retailerAgg.get(rid) ?? { invoiced: 0, paid: 0, net: 0 }
    const amt = Number(row.amount)
    cur.net += amt
    if (row.type === 'invoice') cur.invoiced += amt
    if (row.type === 'payment') cur.paid += -amt
    retailerAgg.set(rid, cur)
  }

  const retailerIds = [...retailerAgg.keys()]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, business_name, name, city')
    .in('user_id', retailerIds)

  const profMap = new Map((profiles ?? []).map((p) => [p.user_id, p]))

  const { data: orderCounts } = await supabase.from('orders').select('retailer_id').eq('supplier_id', sid)
  const orderCountByRetailer = new Map<string, number>()
  for (const o of orderCounts ?? []) {
    orderCountByRetailer.set(o.retailer_id, (orderCountByRetailer.get(o.retailer_id) ?? 0) + 1)
  }

  const topRetailers: TopRetailerRow[] = [...retailerAgg.entries()]
    .map(([rid, v]) => {
      const p = profMap.get(rid)
      return {
        retailerLabel: p?.business_name || p?.name || 'Retailer',
        city: p?.city ?? null,
        orderCount: orderCountByRetailer.get(rid) ?? 0,
        totalInvoiced: Math.round(v.invoiced * 100) / 100,
        totalPaid: Math.round(v.paid * 100) / 100,
        outstanding: Math.round(v.net * 100) / 100,
      }
    })
    .sort((a, b) => b.outstanding - a.outstanding)

  const { data: invs } = await supabase
    .from('invoices')
    .select('id, invoice_number, retailer_id, issued_at, due_date, total, status')
    .eq('supplier_id', sid)
    .neq('status', 'paid')

  const { data: paySums } = await supabase.from('payments').select('invoice_id, amount')
  const paidByInvoice = new Map<string, number>()
  for (const p of paySums ?? []) {
    paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) ?? 0) + Number(p.amount))
  }

  const outstandingInvoices: OutstandingInvoiceRow[] = (invs ?? []).map((inv) => {
    const paid = paidByInvoice.get(inv.id) ?? 0
    const total = Number(inv.total)
    const outstanding = Math.round((total - paid) * 100) / 100
    const issued = new Date(inv.issued_at)
    const days = Math.floor((now.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24))
    let ageBucket: OutstandingInvoiceRow['ageBucket'] = 'current'
    if (days >= 90) ageBucket = '90_plus'
    else if (days >= 60) ageBucket = '60_90'
    else if (days >= 30) ageBucket = '30_60'

    const rp = profMap.get(inv.retailer_id)
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      retailerLabel: rp?.business_name || rp?.name || 'Retailer',
      issued_at: inv.issued_at,
      due_date: inv.due_date,
      total,
      paid: Math.round(paid * 100) / 100,
      outstanding,
      status: inv.status,
      ageBucket,
    }
  })

  outstandingInvoices.sort((a, b) => b.outstanding - a.outstanding)

  return {
    monthly,
    topProducts,
    topRetailers,
    outstandingInvoices,
    ordersThisMonth: ordersThisMonth ?? 0,
    activeRetailers,
  }
}
