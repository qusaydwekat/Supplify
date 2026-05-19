import { roundMoney2 } from '@/lib/currency'
import { supabaseServer } from '@/lib/supabase/server'
import { totalPagesFromCount, type PaginatedResult } from '@/lib/data/pagination'
import { orderRowsNewestFirst } from '@/lib/data/order-sort'
import type {
  DeliveredOrderOption,
  InstallmentRow,
  InvoiceDetail,
  InvoiceListRow,
  InvoiceStatus,
  PaymentRow,
} from '@/lib/invoices-types'

export type {
  DeliveredOrderOption,
  InstallmentRow,
  InvoiceDetail,
  InvoiceItemRow,
  InvoiceListRow,
  InvoiceStatus,
  PaymentRow,
} from '@/lib/invoices-types'

export async function getInvoiceForOrder(
  orderId: string,
): Promise<{ id: string; invoice_number: string; status: InvoiceStatus } | null> {
  const supabase = supabaseServer()
  const { data } = await supabase
    .from('invoices')
    .select('id, invoice_number, status')
    .eq('order_id', orderId)
    .maybeSingle()
  return data ? { ...data, status: data.status as InvoiceStatus } : null
}

function formatNotInList(ids: string[]) {
  return `(${ids.join(',')})`
}

export async function listDeliveredOrdersForInvoicing(opts: {
  page: number
  pageSize: number
}): Promise<PaginatedResult<DeliveredOrderOption> | { error: string }> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: supplier } = await supabase.from('suppliers').select('id, currency_code').eq('user_id', user.id).maybeSingle()
  if (!supplier) return { error: 'Not a supplier' }
  const supplierCurrency = String((supplier as { currency_code?: string }).currency_code ?? 'USD')

  const { data: existing } = await supabase.from('invoices').select('order_id').eq('supplier_id', supplier.id)
  const invoicedIds = [...new Set((existing ?? []).map((r) => r.order_id).filter(Boolean))] as string[]

  const from = (opts.page - 1) * opts.pageSize
  const to = from + opts.pageSize - 1

  let q = supabase
    .from('orders')
    .select('id, created_at, total_price, retailer_id, status', { count: 'exact' })
    .eq('supplier_id', supplier.id)
    .eq('status', 'delivered')

  if (invoicedIds.length) {
    q = q.not('id', 'in', formatNotInList(invoicedIds))
  }

  const { data: orders, error, count } = await orderRowsNewestFirst(q).range(from, to)

  if (error) return { error: error.message }

  const totalCount = count ?? 0
  const totalPages = totalPagesFromCount(totalCount, opts.pageSize)
  if (!orders?.length) {
    return { rows: [], page: opts.page, pageSize: opts.pageSize, totalCount, totalPages }
  }

  const retailerIds = [...new Set(orders.map((o) => o.retailer_id))]
  const { data: profiles } = await supabase.from('profiles').select('user_id, business_name, name').in('user_id', retailerIds)
  const profMap = new Map((profiles ?? []).map((p) => [p.user_id, p]))

  const { data: termRows } = await supabase
    .from('retailer_supplier_terms')
    .select('retailer_id, payment_terms_days')
    .eq('supplier_id', supplier.id)
    .in('retailer_id', retailerIds)
  const dueDaysByRetailer = new Map(
    (termRows ?? []).map((r) => [r.retailer_id as string, Math.min(365, Math.max(1, Number(r.payment_terms_days)))]),
  )

  const rows: DeliveredOrderOption[] = orders.map((o) => {
    const p = profMap.get(o.retailer_id)
    return {
      id: o.id,
      created_at: o.created_at,
      total_price: Number(o.total_price),
      retailerLabel: p?.business_name || p?.name || 'Retailer',
      supplier_currency: supplierCurrency,
      default_due_days: dueDaysByRetailer.get(o.retailer_id) ?? 14,
    }
  })

  return { rows, page: opts.page, pageSize: opts.pageSize, totalCount, totalPages }
}

export type SupplierInvoiceListFilters = {
  status?: string | null
  search?: string | null
  dateFrom?: string | null
  dateTo?: string | null
}

const INVOICE_LIST_STATUSES: readonly InvoiceStatus[] = ['issued', 'paid', 'partial', 'overdue']

function invoiceStartOfDayIso(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function invoiceEndOfDayIso(dateStr: string) {
  const d = new Date(dateStr + 'T23:59:59.999')
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

async function attachInvoiceListBalances(
  supabase: ReturnType<typeof supabaseServer>,
  rows: Omit<InvoiceListRow, 'remaining' | 'next_installment_due' | 'balances_unavailable'>[],
): Promise<InvoiceListRow[]> {
  if (!rows.length) return []

  const ids = rows.map((r) => r.id)

  const { data: payRows, error: payErr } = await supabase
    .from('payments')
    .select('id, invoice_id, amount')
    .in('invoice_id', ids)

  if (payErr) {
    return rows.map((r) => ({
      ...r,
      remaining: null,
      next_installment_due: r.due_date,
      balances_unavailable: true,
    }))
  }

  const paidByInvoice = new Map<string, number>()
  const paymentIds: string[] = []
  for (const p of payRows ?? []) {
    const iid = p.invoice_id as string
    paidByInvoice.set(iid, roundMoney2((paidByInvoice.get(iid) ?? 0) + Number(p.amount)))
    paymentIds.push(p.id as string)
  }

  const { data: instRows } = await supabase
    .from('invoice_installments')
    .select('id, invoice_id, seq, due_date, amount_due')
    .in('invoice_id', ids)
    .order('seq')

  const instByInvoice = new Map<string, { id: string; seq: number; due_date: string; amount_due: number }[]>()
  for (const row of instRows ?? []) {
    const invId = row.invoice_id as string
    const list = instByInvoice.get(invId) ?? []
    list.push({
      id: row.id as string,
      seq: Number(row.seq),
      due_date: row.due_date as string,
      amount_due: Number(row.amount_due),
    })
    instByInvoice.set(invId, list)
  }

  const allocByInst = new Map<string, number>()
  if (paymentIds.length) {
    const { data: allocs } = await supabase
      .from('payment_installment_allocations')
      .select('installment_id, amount')
      .in('payment_id', paymentIds)
    for (const a of allocs ?? []) {
      const iid = a.installment_id as string
      allocByInst.set(iid, roundMoney2((allocByInst.get(iid) ?? 0) + Number(a.amount)))
    }
  }

  return rows.map((r) => {
    const paid = paidByInvoice.get(r.id) ?? 0
    const remaining = roundMoney2(Number(r.total) - paid)
    let next_installment_due: string | null = null
    const insts = instByInvoice.get(r.id)
    if (remaining > 0.001) {
      if (insts?.length) {
        const sorted = [...insts].sort((a, b) => a.seq - b.seq)
        for (const inst of sorted) {
          const toward = allocByInst.get(inst.id) ?? 0
          const left = roundMoney2(inst.amount_due - toward)
          if (left > 0.001) {
            next_installment_due = inst.due_date
            break
          }
        }
      }
      // Fallback: invoice's own due_date when there is no installment schedule.
      if (!next_installment_due) next_installment_due = r.due_date
    }
    return { ...r, remaining, next_installment_due, balances_unavailable: false }
  })
}

export async function getSupplierInvoiceList(
  opts: { page: number; pageSize: number } & SupplierInvoiceListFilters,
): Promise<PaginatedResult<InvoiceListRow> | { error: string }> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  if (!supplier) return { error: 'Not a supplier' }

  const from = (opts.page - 1) * opts.pageSize
  const to = from + opts.pageSize - 1

  let invQuery = supabase
    .from('invoices')
    .select('id, invoice_number, status, total, currency_code, issued_at, due_date, retailer_id', { count: 'exact' })
    .eq('supplier_id', supplier.id)

  const statusFilter = opts.status?.trim()
  if (statusFilter && INVOICE_LIST_STATUSES.includes(statusFilter as InvoiceStatus)) {
    invQuery = invQuery.eq('status', statusFilter)
  }

  const fromIso = opts.dateFrom?.trim() ? invoiceStartOfDayIso(opts.dateFrom.trim()) : null
  if (fromIso) invQuery = invQuery.gte('issued_at', fromIso)
  const toIso = opts.dateTo?.trim() ? invoiceEndOfDayIso(opts.dateTo.trim()) : null
  if (toIso) invQuery = invQuery.lte('issued_at', toIso)

  const search = opts.search?.trim()
  if (search) {
    const { data: invRows, error: searchErr } = await supabase
      .from('invoices')
      .select('id, retailer_id, invoice_number')
      .eq('supplier_id', supplier.id)
    if (searchErr) return { error: searchErr.message }
    const lower = search.toLowerCase()
    const matchedIds = new Set<string>()
    for (const row of invRows ?? []) {
      if (String(row.invoice_number).toLowerCase().includes(lower)) matchedIds.add(row.id as string)
    }
    const retailerScope = [...new Set((invRows ?? []).map((r) => r.retailer_id as string))]
    if (retailerScope.length) {
      const { data: profs, error: pErr } = await supabase
        .from('profiles')
        .select('user_id, business_name, name')
        .in('user_id', retailerScope)
      if (pErr) return { error: pErr.message }
      const matchedRetailers = new Set(
        (profs ?? [])
          .filter((p) => {
            const bn = (p.business_name ?? '').toLowerCase()
            const nm = (p.name ?? '').toLowerCase()
            return bn.includes(lower) || nm.includes(lower)
          })
          .map((p) => p.user_id as string),
      )
      for (const row of invRows ?? []) {
        if (matchedRetailers.has(row.retailer_id as string)) matchedIds.add(row.id as string)
      }
    }
    if (!matchedIds.size) {
      return {
        rows: [],
        page: opts.page,
        pageSize: opts.pageSize,
        totalCount: 0,
        totalPages: totalPagesFromCount(0, opts.pageSize),
      }
    }
    invQuery = invQuery.in('id', [...matchedIds])
  }

  const { data: invoices, error, count } = await invQuery.order('issued_at', { ascending: false }).range(from, to)

  if (error) return { error: error.message }

  const totalCount = count ?? 0
  const totalPages = totalPagesFromCount(totalCount, opts.pageSize)
  if (!invoices?.length) {
    return { rows: [], page: opts.page, pageSize: opts.pageSize, totalCount, totalPages }
  }

  const retailerIds = [...new Set(invoices.map((i) => i.retailer_id))]
  const { data: profiles } = await supabase.from('profiles').select('user_id, business_name, name').in('user_id', retailerIds)
  const profMap = new Map((profiles ?? []).map((p) => [p.user_id, p]))

  const rowsBase = invoices.map((inv) => {
    const p = profMap.get(inv.retailer_id)
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      status: inv.status as InvoiceStatus,
      total: Number(inv.total),
      currency_code: String((inv as { currency_code?: string }).currency_code ?? 'USD'),
      issued_at: inv.issued_at,
      due_date: inv.due_date,
      counterparty: p?.business_name || p?.name || 'Retailer',
    }
  })

  const rows = await attachInvoiceListBalances(supabase, rowsBase)

  return { rows, page: opts.page, pageSize: opts.pageSize, totalCount, totalPages }
}

export async function getRetailerInvoiceList(opts: {
  page: number
  pageSize: number
}): Promise<PaginatedResult<InvoiceListRow> | { error: string }> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const from = (opts.page - 1) * opts.pageSize
  const to = from + opts.pageSize - 1

  const { data: invoices, error, count } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, total, currency_code, issued_at, due_date, supplier_id', { count: 'exact' })
    .eq('retailer_id', user.id)
    .order('issued_at', { ascending: false })
    .range(from, to)

  if (error) return { error: error.message }

  const totalCount = count ?? 0
  const totalPages = totalPagesFromCount(totalCount, opts.pageSize)
  if (!invoices?.length) {
    return { rows: [], page: opts.page, pageSize: opts.pageSize, totalCount, totalPages }
  }

  const supplierIds = [...new Set(invoices.map((i) => i.supplier_id))]
  const { data: suppliers } = await supabase.from('suppliers').select('id, user_id').in('id', supplierIds)
  const userIds = [...new Set((suppliers ?? []).map((s) => s.user_id))]
  const { data: profiles } = await supabase.from('profiles').select('user_id, business_name').in('user_id', userIds)
  const profByUser = new Map((profiles ?? []).map((p) => [p.user_id, p]))
  const supMap = new Map<string, string>()
  for (const s of suppliers ?? []) {
    const p = profByUser.get(s.user_id)
    supMap.set(s.id, p?.business_name ?? 'Supplier')
  }

  const rowsBase = invoices.map((inv) => ({
    id: inv.id,
    invoice_number: inv.invoice_number,
    status: inv.status as InvoiceStatus,
    total: Number(inv.total),
    currency_code: String((inv as { currency_code?: string }).currency_code ?? 'USD'),
    issued_at: inv.issued_at,
    due_date: inv.due_date,
    counterparty: supMap.get(inv.supplier_id) ?? 'Supplier',
  }))

  const rows = await attachInvoiceListBalances(supabase, rowsBase)

  return { rows, page: opts.page, pageSize: opts.pageSize, totalCount, totalPages }
}

async function loadInvoiceDetail(invoiceId: string, role: 'supplier' | 'retailer'): Promise<{ invoice: InvoiceDetail } | { error: string }> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: inv, error: invErr } = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle()
  if (invErr || !inv) return { error: invErr?.message ?? 'Invoice not found' }

  if (role === 'supplier') {
    const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
    if (!supplier || supplier.id !== inv.supplier_id) return { error: 'Forbidden' }
  } else {
    if (inv.retailer_id !== user.id) return { error: 'Forbidden' }
  }

  const { data: items, error: iErr } = await supabase
    .from('invoice_items')
    .select('id, product_name, variation_name, quantity, unit_price, total_price')
    .eq('invoice_id', invoiceId)
    .order('id')

  if (iErr || !items) return { error: iErr?.message ?? 'Could not load lines' }

  const { data: payments } = await supabase
    .from('payments')
    .select(
      'id, amount, payment_currency, payment_amount, amount_in_default_currency, method, reference_note, cheque_number, cheque_bank_name, cheque_branch, cheque_date, cheque_bank_branch_id, cheque_status, cheque_cleared_at, cheque_bounced_at, cheque_bounce_reason, withholding_amount, withholding_reference, created_at',
    )
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true })

  const payRows: PaymentRow[] = (payments ?? []).map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    payment_currency: String((p as { payment_currency?: string }).payment_currency ?? 'USD'),
    payment_amount: Number((p as { payment_amount?: number }).payment_amount ?? p.amount),
    amount_in_default_currency: Number((p as { amount_in_default_currency?: number }).amount_in_default_currency ?? p.amount),
    method: p.method,
    reference_note: p.reference_note,
    cheque_number: (p as { cheque_number?: string | null }).cheque_number ?? null,
    cheque_bank_name: (p as { cheque_bank_name?: string | null }).cheque_bank_name ?? null,
    cheque_branch: (p as { cheque_branch?: string | null }).cheque_branch ?? null,
    cheque_date: (p as { cheque_date?: string | null }).cheque_date ?? null,
    cheque_bank_branch_id: (p as { cheque_bank_branch_id?: string | null }).cheque_bank_branch_id ?? null,
    cheque_status: ((p as { cheque_status?: PaymentRow['cheque_status'] }).cheque_status ?? null),
    cheque_cleared_at: (p as { cheque_cleared_at?: string | null }).cheque_cleared_at ?? null,
    cheque_bounced_at: (p as { cheque_bounced_at?: string | null }).cheque_bounced_at ?? null,
    cheque_bounce_reason: (p as { cheque_bounce_reason?: string | null }).cheque_bounce_reason ?? null,
    withholding_amount: Number((p as { withholding_amount?: number }).withholding_amount ?? 0),
    withholding_reference: (p as { withholding_reference?: string | null }).withholding_reference ?? null,
    created_at: p.created_at,
  }))

  const paidTotal = Math.round(payRows.reduce((s, p) => s + p.amount, 0) * 100) / 100
  const total = Number(inv.total)
  const remaining = Math.round((total - paidTotal) * 100) / 100

  const { data: instRows } = await supabase
    .from('invoice_installments')
    .select('id, seq, due_date, amount_due')
    .eq('invoice_id', invoiceId)
    .order('seq')

  let installmentAllocRows: { installment_id: string; amount: number }[] = []
  const paymentAllocations: Record<string, { installment_id: string; amount: number }[]> = {}
  if (instRows?.length && payRows.length) {
    const paymentIds = payRows.map((p) => p.id)
    const { data: allocs } = await supabase
      .from('payment_installment_allocations')
      .select('payment_id, installment_id, amount')
      .in('payment_id', paymentIds)
    installmentAllocRows = (allocs ?? []) as { installment_id: string; amount: number }[]
    for (const a of (allocs ?? []) as { payment_id: string; installment_id: string; amount: number }[]) {
      const list = paymentAllocations[a.payment_id] ?? []
      list.push({ installment_id: a.installment_id, amount: Number(a.amount) })
      paymentAllocations[a.payment_id] = list
    }
  }

  const allocByInst = new Map<string, number>()
  for (const a of installmentAllocRows) {
    const id = a.installment_id as string
    allocByInst.set(id, (allocByInst.get(id) ?? 0) + Number(a.amount))
  }

  const installments: InstallmentRow[] = (instRows ?? []).map((row) => {
    const id = row.id as string
    const amountDue = Number(row.amount_due)
    const paidToward = Math.round((allocByInst.get(id) ?? 0) * 100) / 100
    return {
      id,
      seq: row.seq as number,
      due_date: row.due_date as string,
      amount_due: amountDue,
      paid_toward: paidToward,
      remaining: Math.round((amountDue - paidToward) * 100) / 100,
    }
  })

  const canEditInstallmentSchedule = paidTotal < 0.001

  let counterparty = ''
  if (role === 'supplier') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('business_name, name')
      .eq('user_id', inv.retailer_id)
      .maybeSingle()
    counterparty = profile?.business_name || profile?.name || 'Retailer'
  } else {
    const { data: sup } = await supabase.from('suppliers').select('user_id').eq('id', inv.supplier_id).maybeSingle()
    if (sup) {
      const { data: profile } = await supabase.from('profiles').select('business_name').eq('user_id', sup.user_id).maybeSingle()
      counterparty = profile?.business_name ?? 'Supplier'
    } else {
      counterparty = 'Supplier'
    }
  }

  const invCurrency = String((inv as { currency_code?: string }).currency_code ?? 'USD')

  return {
    invoice: {
      id: inv.id,
      invoice_number: inv.invoice_number,
      status: inv.status as InvoiceStatus,
      total,
      currency_code: invCurrency,
      issued_at: inv.issued_at,
      due_date: inv.due_date,
      paid_at: inv.paid_at,
      notes: inv.notes,
      order_id: inv.order_id,
      supplier_id: inv.supplier_id,
      retailer_id: inv.retailer_id,
      items: items.map((i) => ({
        id: i.id,
        product_name: i.product_name,
        variation_name: i.variation_name,
        quantity: i.quantity,
        unit_price: Number(i.unit_price),
        total_price: Number(i.total_price),
      })),
      payments: payRows,
      paidTotal,
      remaining,
      counterparty,
      installments,
      canEditInstallmentSchedule,
      paymentAllocations,
    },
  }
}

export async function getSupplierInvoiceDetail(invoiceId: string) {
  return loadInvoiceDetail(invoiceId, 'supplier')
}

export async function getRetailerInvoiceDetail(invoiceId: string) {
  return loadInvoiceDetail(invoiceId, 'retailer')
}

export async function getInvoiceForViewer(invoiceId: string): Promise<{ invoice: InvoiceDetail } | { error: string }> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: roleRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (roleRow?.role === 'supplier') return loadInvoiceDetail(invoiceId, 'supplier')
  if (roleRow?.role === 'retailer') return loadInvoiceDetail(invoiceId, 'retailer')
  return { error: 'Forbidden' }
}
