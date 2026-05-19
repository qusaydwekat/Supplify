import { supabaseServer } from '@/lib/supabase/server'
import { loadCurrencyConversionState } from '@/lib/currency'
import { orderRowsNewestFirst } from '@/lib/data/order-sort'

export type RetailerDashboardStats = {
  pendingOrders: number
  openInvoices: number
  balanceOwing: number
  displayCurrency: string
  pendingDepositProofs: number
  invoiceStatusCounts: { issued: number; partial: number; overdue: number; paid: number }
  recentOrders: { id: string; supplierName: string; total: number; status: string; createdAt: string }[]
  monthlySpend: { label: string; invoiced: number; paid: number }[]
}

export async function getRetailerDashboardStats(): Promise<{ stats: RetailerDashboardStats } | { error: string }> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const conv = await loadCurrencyConversionState(supabase)
  const displayCurrency = 'error' in conv ? 'USD' : conv.defaultCurrency

  const { count: pendingOrders } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('retailer_id', user.id)
    .in('status', ['pending', 'modified'])

  const { data: invStatusRows } = await supabase.from('invoices').select('status').eq('retailer_id', user.id)
  const invoiceStatusCounts = { issued: 0, partial: 0, overdue: 0, paid: 0 }
  for (const r of invStatusRows ?? []) {
    const st = String((r as { status: string }).status)
    if (st === 'issued') invoiceStatusCounts.issued += 1
    else if (st === 'partial') invoiceStatusCounts.partial += 1
    else if (st === 'overdue') invoiceStatusCounts.overdue += 1
    else if (st === 'paid') invoiceStatusCounts.paid += 1
  }
  const openInvoices = invoiceStatusCounts.issued + invoiceStatusCounts.partial + invoiceStatusCounts.overdue

  const { count: pendingDepositProofs } = await supabase
    .from('payment_deposit_proofs')
    .select('*', { count: 'exact', head: true })
    .eq('retailer_id', user.id)
    .eq('status', 'pending')

  const { data: ledgerRows } = await supabase
    .from('ledger_entries')
    .select('amount, type, created_at')
    .eq('retailer_id', user.id)

  const balanceOwing = Math.round((ledgerRows ?? []).reduce((s, r) => s + Number((r as any).amount), 0) * 100) / 100

  // 6-month trend (invoiced vs paid)
  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const map = new Map<string, { invoiced: number; paid: number }>()
  for (let i = 0; i < 6; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    map.set(monthKey(d), { invoiced: 0, paid: 0 })
  }
  for (const row of ledgerRows ?? []) {
    const d = new Date((row as any).created_at)
    const k = monthKey(d)
    const bucket = map.get(k)
    if (!bucket) continue
    const amt = Number((row as any).amount)
    const type = String((row as any).type)
    if (type === 'invoice' || type === 'debit_note') bucket.invoiced += amt
    if (type === 'payment' || type === 'credit_note') bucket.paid += -amt
  }
  const monthlySpend = [...map.entries()].map(([k, v]) => {
    const [, m] = k.split('-').map(Number)
    return {
      label: MONTH_LABELS[m - 1],
      invoiced: Math.round(v.invoiced * 100) / 100,
      paid: Math.round(v.paid * 100) / 100,
    }
  })

  // Recent orders (last 5) with supplier business name
  const { data: recent } = await orderRowsNewestFirst(
    supabase.from('orders').select('id, supplier_id, total_price, status, created_at').eq('retailer_id', user.id),
  ).limit(5)

  const supplierIds = [...new Set((recent ?? []).map((o: any) => o.supplier_id))]
  const { data: suppliers } = supplierIds.length
    ? await supabase.from('suppliers').select('id, user_id').in('id', supplierIds)
    : { data: [] as { id: string; user_id: string }[] }

  const supplierUserIds = [...new Set((suppliers ?? []).map((s: any) => s.user_id))]
  const { data: profiles } = supplierUserIds.length
    ? await supabase.from('profiles').select('user_id, business_name').in('user_id', supplierUserIds)
    : { data: [] as { user_id: string; business_name: string | null }[] }

  const profByUser = new Map((profiles ?? []).map((p) => [p.user_id, p]))
  const userIdBySupplierId = new Map((suppliers ?? []).map((s: any) => [s.id, s.user_id]))

  const recentOrders = (recent ?? []).map((o: any) => {
    const uid = userIdBySupplierId.get(o.supplier_id)
    const name = uid ? profByUser.get(uid)?.business_name : null
    return {
      id: o.id,
      supplierName: name ?? 'Supplier',
      total: Number(o.total_price),
      status: String(o.status),
      createdAt: o.created_at,
    }
  })

  return {
    stats: {
      pendingOrders: pendingOrders ?? 0,
      openInvoices,
      balanceOwing,
      displayCurrency,
      pendingDepositProofs: pendingDepositProofs ?? 0,
      invoiceStatusCounts,
      recentOrders,
      monthlySpend,
    },
  }
}
