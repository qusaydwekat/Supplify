import type { SupabaseClient } from '@supabase/supabase-js'

export type CreditEnforcementMode = 'block' | 'warn'

export type RetailerSupplierTermsRow = {
  supplier_id: string
  retailer_id: string
  credit_limit: number | null
  payment_terms_days: number
  grace_days: number
  blocked: boolean
  credit_enforcement_mode: CreditEnforcementMode
}

const TERMINAL = new Set(['cancelled', 'rejected'])

export async function fetchRetailerSupplierTerms(
  supabase: SupabaseClient,
  supplierId: string,
  retailerId: string,
): Promise<RetailerSupplierTermsRow | null> {
  const { data, error } = await supabase
    .from('retailer_supplier_terms')
    .select(
      'supplier_id, retailer_id, credit_limit, payment_terms_days, grace_days, blocked, credit_enforcement_mode',
    )
    .eq('supplier_id', supplierId)
    .eq('retailer_id', retailerId)
    .maybeSingle()

  if (error || !data) return null
  const modeRaw = (data as { credit_enforcement_mode?: string }).credit_enforcement_mode
  const credit_enforcement_mode: CreditEnforcementMode =
    modeRaw === 'warn' ? 'warn' : 'block'
  return {
    supplier_id: data.supplier_id,
    retailer_id: data.retailer_id,
    credit_limit: data.credit_limit === null || data.credit_limit === undefined ? null : Number(data.credit_limit),
    payment_terms_days: Number(data.payment_terms_days),
    grace_days: Number(data.grace_days),
    blocked: Boolean(data.blocked),
    credit_enforcement_mode,
  }
}

export async function sumLedgerBalance(
  supabase: SupabaseClient,
  supplierId: string,
  retailerId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('ledger_entries')
    .select('amount')
    .eq('supplier_id', supplierId)
    .eq('retailer_id', retailerId)

  if (error || !data?.length) return 0
  return Math.round(data.reduce((s, r) => s + Number(r.amount), 0) * 100) / 100
}

/** Sum of order totals that are not cancelled/rejected and have no invoice yet. Optionally exclude one order (replace with candidate total separately). */
export async function sumUninvoicedOpenOrders(
  supabase: SupabaseClient,
  supplierId: string,
  retailerId: string,
  excludeOrderId?: string,
): Promise<number> {
  const { data: orders, error: oErr } = await supabase
    .from('orders')
    .select('id, total_price, status')
    .eq('supplier_id', supplierId)
    .eq('retailer_id', retailerId)

  if (oErr || !orders?.length) return 0

  const active = orders.filter((o) => !TERMINAL.has(String(o.status)))
  const orderIds = active.map((o) => o.id)
  if (!orderIds.length) return 0

  const { data: invs, error: iErr } = await supabase.from('invoices').select('order_id').in('order_id', orderIds)

  if (iErr) return 0
  const invoiced = new Set((invs ?? []).map((r) => r.order_id as string))

  let sum = 0
  for (const o of active) {
    if (invoiced.has(o.id)) continue
    if (excludeOrderId && o.id === excludeOrderId) continue
    sum += Number(o.total_price)
  }
  return Math.round(sum * 100) / 100
}

export function projectedExposure(args: {
  ledgerBalance: number
  uninvoicedOpenOrdersTotal: number
  candidateOrderTotal: number
}): number {
  const { ledgerBalance, uninvoicedOpenOrdersTotal, candidateOrderTotal } = args
  return Math.round((ledgerBalance + uninvoicedOpenOrdersTotal + candidateOrderTotal) * 100) / 100
}

export type CreditGateResult =
  | {
      ok: true
      /** When enforcement mode is warn and projected exposure exceeds the credit limit */
      creditWarning?: {
        messageKey: 'creditLimitExceeded'
        params: Record<string, string | number>
      }
    }
  | {
      ok: false
      code: 'blocked' | 'over_limit'
      /** Translation key in `Errors` namespace */
      messageKey: 'supplierBlockedOrders' | 'creditLimitExceeded'
      params?: Record<string, string | number>
      /** English fallback (logs/backward compatibility) */
      message: string
    }

export async function evaluateCreditForCommitment(
  supabase: SupabaseClient,
  args: {
    supplierId: string
    retailerId: string
    excludeOrderId?: string
    candidateOrderTotal: number
  },
): Promise<CreditGateResult> {
  const terms = await fetchRetailerSupplierTerms(supabase, args.supplierId, args.retailerId)
  if (!terms) return { ok: true }
  if (terms.blocked) {
    return {
      ok: false,
      code: 'blocked',
      messageKey: 'supplierBlockedOrders',
      message: 'This supplier has blocked new orders for your account. Contact them to resolve.',
    }
  }
  if (terms.credit_limit === null || terms.credit_limit === undefined) {
    return { ok: true }
  }

  const ledger = await sumLedgerBalance(supabase, args.supplierId, args.retailerId)
  const open = await sumUninvoicedOpenOrders(supabase, args.supplierId, args.retailerId, args.excludeOrderId)
  const projected = projectedExposure({
    ledgerBalance: ledger,
    uninvoicedOpenOrdersTotal: open,
    candidateOrderTotal: args.candidateOrderTotal,
  })

  if (projected > terms.credit_limit + 1e-6) {
    const params = {
      limit: Number(terms.credit_limit.toFixed(2)),
      projected: Number(projected.toFixed(2)),
    }
    const message = `This order would exceed your credit limit with this supplier (limit ${terms.credit_limit.toFixed(2)}, projected exposure ${projected.toFixed(2)}). Pay down open invoices or ask the supplier to adjust your limit.`

    if (terms.credit_enforcement_mode === 'warn') {
      return {
        ok: true,
        creditWarning: {
          messageKey: 'creditLimitExceeded' as const,
          params,
        },
      }
    }

    return {
      ok: false,
      code: 'over_limit',
      messageKey: 'creditLimitExceeded',
      params,
      message,
    }
  }

  return { ok: true }
}

/** Outstanding balance on invoices past due_date (issued/partial/overdue with open balance). */
export async function sumOverdueOpenBalance(
  supabase: SupabaseClient,
  supplierId: string,
  retailerId: string,
): Promise<number> {
  const now = new Date().toISOString()
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, total')
    .eq('supplier_id', supplierId)
    .eq('retailer_id', retailerId)
    .not('due_date', 'is', null)
    .lt('due_date', now)
    .in('status', ['issued', 'partial', 'overdue'])

  if (error || !invoices?.length) return 0

  const ids = invoices.map((i) => i.id as string)
  const { data: payments } = await supabase.from('payments').select('invoice_id, amount').in('invoice_id', ids)

  const paidByInvoice = new Map<string, number>()
  for (const p of payments ?? []) {
    const iid = p.invoice_id as string
    paidByInvoice.set(iid, (paidByInvoice.get(iid) ?? 0) + Number(p.amount))
  }

  let sum = 0
  for (const inv of invoices) {
    const id = inv.id as string
    const paid = paidByInvoice.get(id) ?? 0
    const open = Number(inv.total) - paid
    if (open > 1e-6) sum += open
  }

  return Math.round(sum * 100) / 100
}
