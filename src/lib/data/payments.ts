import { supabaseServer } from '@/lib/supabase/server'
import { totalPagesFromCount, type PaginatedResult } from '@/lib/data/pagination'
import type { ChequeStatus } from '@/lib/invoices-types'

export type SupplierPaymentFilters = {
  method?: string | null
  dateFrom?: string | null
  dateTo?: string | null
}

export type SupplierPaymentRow = {
  id: string
  created_at: string
  amount: number
  payment_currency: string
  payment_amount: number
  amount_in_default_currency: number
  invoice_currency: string
  method: string
  reference_note: string | null
  cheque_number: string | null
  cheque_bank_name: string | null
  cheque_branch: string | null
  cheque_date: string | null
  invoice_id: string
  invoice_number: string
  retailer_label: string
}

export function formatPaymentMoney(n: number, currencyCode: string = 'USD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(n)
}

function startOfDayIso(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function endOfDayIso(dateStr: string) {
  const d = new Date(dateStr + 'T23:59:59.999')
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export async function getSupplierPaymentHistory(
  filters: SupplierPaymentFilters = {},
  pagination: { page: number; pageSize: number },
): Promise<PaginatedResult<SupplierPaymentRow> | { error: string }> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  if (!supplier) return { error: 'Not a supplier' }

  const { data: invoices, error: invErr } = await supabase
    .from('invoices')
    .select('id, invoice_number, retailer_id, currency_code')
    .eq('supplier_id', supplier.id)

  if (invErr) return { error: invErr.message }
  if (!invoices?.length) {
    return {
      rows: [],
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalCount: 0,
      totalPages: 1,
    }
  }

  const invMap = new Map(
    invoices.map((i) => [
      i.id,
      {
        number: i.invoice_number,
        retailer_id: i.retailer_id,
        currency_code: String((i as { currency_code?: string }).currency_code ?? 'USD'),
      },
    ]),
  )
  const invoiceIds = invoices.map((i) => i.id)

  const retailerIds = [...new Set(invoices.map((i) => i.retailer_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, business_name, name')
    .in('user_id', retailerIds)
  const profMap = new Map((profiles ?? []).map((p) => [p.user_id, p]))

  const from = (pagination.page - 1) * pagination.pageSize
  const to = from + pagination.pageSize - 1

  let payQuery = supabase
    .from('payments')
    .select(
      'id, amount, payment_currency, payment_amount, amount_in_default_currency, method, reference_note, cheque_number, cheque_bank_name, cheque_branch, cheque_date, created_at, invoice_id',
      { count: 'exact' },
    )
    .in('invoice_id', invoiceIds)
    .order('created_at', { ascending: false })

  const method = filters.method?.trim()
  if (method && ['cash', 'bank', 'cheque', 'other'].includes(method)) {
    payQuery = payQuery.eq('method', method)
  }

  const fromIso = filters.dateFrom?.trim() ? startOfDayIso(filters.dateFrom.trim()) : null
  if (fromIso) payQuery = payQuery.gte('created_at', fromIso)

  const toIso = filters.dateTo?.trim() ? endOfDayIso(filters.dateTo.trim()) : null
  if (toIso) payQuery = payQuery.lte('created_at', toIso)

  const { data: payments, error: payErr, count } = await payQuery.range(from, to)

  if (payErr) return { error: payErr.message }

  const totalCount = count ?? 0
  const totalPages = totalPagesFromCount(totalCount, pagination.pageSize)

  const rows: SupplierPaymentRow[] = (payments ?? []).map((p) => {
    const inv = invMap.get(p.invoice_id)
    const rp = inv ? profMap.get(inv.retailer_id) : undefined
    return {
      id: p.id,
      created_at: p.created_at,
      amount: Number(p.amount),
      payment_currency: String((p as { payment_currency?: string }).payment_currency ?? 'USD'),
      payment_amount: Number((p as { payment_amount?: number }).payment_amount ?? p.amount),
      amount_in_default_currency: Number(
        (p as { amount_in_default_currency?: number }).amount_in_default_currency ?? p.amount,
      ),
      invoice_currency: inv?.currency_code ?? 'USD',
      method: p.method,
      reference_note: p.reference_note,
      cheque_number: (p as { cheque_number?: string | null }).cheque_number ?? null,
      cheque_bank_name: (p as { cheque_bank_name?: string | null }).cheque_bank_name ?? null,
      cheque_branch: (p as { cheque_branch?: string | null }).cheque_branch ?? null,
      cheque_date: (p as { cheque_date?: string | null }).cheque_date ?? null,
      invoice_id: p.invoice_id,
      invoice_number: inv?.number ?? '—',
      retailer_label: rp?.business_name || rp?.name || 'Retailer',
    }
  })

  return { rows, page: pagination.page, pageSize: pagination.pageSize, totalCount, totalPages }
}

export type RetailerPaymentRow = {
  id: string
  created_at: string
  amount: number
  payment_currency: string
  payment_amount: number
  amount_in_default_currency: number
  invoice_currency: string
  method: string
  reference_note: string | null
  cheque_number: string | null
  cheque_bank_name: string | null
  cheque_branch: string | null
  cheque_date: string | null
  invoice_id: string
  invoice_number: string
  supplier_label: string
  cheque_status: ChequeStatus | null
  cheque_bounce_reason: string | null
}

export async function getRetailerPaymentHistory(pagination: {
  page: number
  pageSize: number
}): Promise<PaginatedResult<RetailerPaymentRow> | { error: string }> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: invoices, error: invErr } = await supabase
    .from('invoices')
    .select('id, invoice_number, supplier_id, currency_code')
    .eq('retailer_id', user.id)

  if (invErr) return { error: invErr.message }
  if (!invoices?.length) {
    return {
      rows: [],
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalCount: 0,
      totalPages: 1,
    }
  }

  const invById = new Map(
    invoices.map((i) => [
      i.id,
      {
        ...i,
        currency_code: String((i as { currency_code?: string }).currency_code ?? 'USD'),
      },
    ]),
  )
  const invoiceIds = invoices.map((i) => i.id)

  const supplierIds = [...new Set(invoices.map((i) => i.supplier_id))]
  const { data: suppliers } = await supabase.from('suppliers').select('id, user_id').in('id', supplierIds)

  const supUserIds = [...new Set((suppliers ?? []).map((s) => s.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, business_name')
    .in('user_id', supUserIds)

  const profileByUser = new Map((profiles ?? []).map((p) => [p.user_id, p]))
  const labelBySupplierId = new Map<string, string>()
  for (const s of suppliers ?? []) {
    const p = profileByUser.get(s.user_id)
    labelBySupplierId.set(s.id, p?.business_name ?? 'Supplier')
  }

  const from = (pagination.page - 1) * pagination.pageSize
  const to = from + pagination.pageSize - 1

  const { data: payments, error: payErr, count } = await supabase
    .from('payments')
    .select(
      'id, amount, payment_currency, payment_amount, amount_in_default_currency, method, reference_note, cheque_number, cheque_bank_name, cheque_branch, cheque_date, cheque_status, cheque_bounce_reason, created_at, invoice_id',
      { count: 'exact' },
    )
    .in('invoice_id', invoiceIds)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (payErr) return { error: payErr.message }

  const totalCount = count ?? 0
  const totalPages = totalPagesFromCount(totalCount, pagination.pageSize)

  const rows: RetailerPaymentRow[] = (payments ?? []).map((p) => {
    const inv = invById.get(p.invoice_id)
    const sid = inv?.supplier_id
    return {
      id: p.id,
      created_at: p.created_at,
      amount: Number(p.amount),
      payment_currency: String((p as { payment_currency?: string }).payment_currency ?? 'USD'),
      payment_amount: Number((p as { payment_amount?: number }).payment_amount ?? p.amount),
      amount_in_default_currency: Number(
        (p as { amount_in_default_currency?: number }).amount_in_default_currency ?? p.amount,
      ),
      invoice_currency: inv?.currency_code ?? 'USD',
      method: p.method,
      reference_note: p.reference_note,
      cheque_number: (p as { cheque_number?: string | null }).cheque_number ?? null,
      cheque_bank_name: (p as { cheque_bank_name?: string | null }).cheque_bank_name ?? null,
      cheque_branch: (p as { cheque_branch?: string | null }).cheque_branch ?? null,
      cheque_date: (p as { cheque_date?: string | null }).cheque_date ?? null,
      invoice_id: p.invoice_id,
      invoice_number: inv?.invoice_number ?? '—',
      supplier_label: sid ? (labelBySupplierId.get(sid) ?? 'Supplier') : '—',
      cheque_status: (p as { cheque_status?: ChequeStatus | null }).cheque_status ?? null,
      cheque_bounce_reason: (p as { cheque_bounce_reason?: string | null }).cheque_bounce_reason ?? null,
    }
  })

  return { rows, page: pagination.page, pageSize: pagination.pageSize, totalCount, totalPages }
}
