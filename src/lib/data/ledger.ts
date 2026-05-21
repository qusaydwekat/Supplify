import { supabaseServer } from '@/lib/supabase/server'
import { loadCurrencyConversionState } from '@/lib/currency'
import { DEFAULT_LEDGER_PAGE_SIZE, clampPageToTotal, totalPagesFromCount } from '@/lib/data/pagination'
import type { ChequeStatus } from '@/lib/invoices-types'

export type LedgerEntryType = 'invoice' | 'payment' | 'credit_note' | 'debit_note'

export type LedgerListRow = {
  id: string
  created_at: string
  type: LedgerEntryType
  amount: number
  description: string | null
  counterpart: string
  runningBalance: number
  reference_id: string
  note?: string | null
  /** Present on supplier ledger rows (partner retailer user id) */
  retailer_id?: string | null
  /** Enriched from payments when type is payment */
  payment_method?: string | null
  cheque_status?: ChequeStatus | null
  cheque_bounce_reason?: string | null
  payment_invoice_id?: string | null
}

export type LedgerFilterOption = { id: string; label: string }

export type LedgerPagination = {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export type AgingBucket = {
  current: number
  days30_60: number
  days60_90: number
  days90_plus: number
}

export type RetailerBalance = {
  retailerId: string
  retailerName: string
  totalInvoiced: number
  totalCollected: number
  outstanding: number
}

export type LedgerPageData = {
  rows: LedgerListRow[]
  netBalance: number
  totalInvoiced: number
  totalCollected: number
  filterOptions: LedgerFilterOption[]
  activeFilterId: string | null
  displayCurrency: string
  pagination?: LedgerPagination
  aging?: AgingBucket
  retailerBalances?: RetailerBalance[]
  retailerBalancesPagination?: LedgerPagination
}

export type LedgerLoadOptions =
  | { load: 'all' }
  | { load: 'page'; page: number; pageSize?: number }

export type LedgerFilterParams = {
  from?: string | null
  to?: string | null
  type?: string | null
}

function roundMoney(n: number) {
  return Math.round(n * 100) / 100
}

/** Newest-first display; running balances are computed chronologically then reversed. */
function reverseLedgerDisplayOrder(rows: LedgerListRow[]): LedgerListRow[] {
  return rows.length <= 1 ? rows : [...rows].reverse()
}

function newestFirstRange(totalCount: number, page: number, pageSize: number) {
  const totalPages = totalPagesFromCount(totalCount, pageSize)
  const safePage = clampPageToTotal(page, totalPages)
  const from = Math.max(0, totalCount - safePage * pageSize)
  const to = Math.min(totalCount - 1, totalCount - (safePage - 1) * pageSize - 1)
  return { from, to, page: safePage, totalPages }
}

function totalsFromSkinny(rows: { amount: string | number; type: string }[]) {
  let totalInvoiced = 0
  let totalCollected = 0
  let net = 0
  for (const r of rows) {
    const amt = Number(r.amount)
    net += amt
    if (r.type === 'invoice' || r.type === 'debit_note') totalInvoiced += amt
    if (r.type === 'payment' || r.type === 'credit_note') totalCollected += -amt
  }
  return {
    netBalance: roundMoney(net),
    totalInvoiced: roundMoney(totalInvoiced),
    totalCollected: roundMoney(totalCollected),
  }
}

export { formatLedgerMoney } from '@/lib/format-money'

async function enrichLedgerRowsWithPaymentDetails(
  supabase: ReturnType<typeof supabaseServer>,
  rows: LedgerListRow[],
): Promise<LedgerListRow[]> {
  const paymentIds = rows.filter((r) => r.type === 'payment').map((r) => r.reference_id)
  if (!paymentIds.length) return rows

  const { data: pays } = await supabase
    .from('payments')
    .select('id, method, cheque_status, cheque_bounce_reason, invoice_id')
    .in('id', paymentIds)

  const payMap = new Map((pays ?? []).map((p) => [p.id, p]))
  return rows.map((row) => {
    if (row.type !== 'payment') return row
    const p = payMap.get(row.reference_id)
    if (!p) return row
    return {
      ...row,
      payment_method: p.method,
      cheque_status: p.method === 'cheque' ? (p.cheque_status as ChequeStatus | null) : null,
      cheque_bounce_reason: (p as { cheque_bounce_reason?: string | null }).cheque_bounce_reason ?? null,
      payment_invoice_id: p.invoice_id,
    }
  })
}

function applyDateTypeFilters<T extends { gte: (col: string, val: string) => T; lte: (col: string, val: string) => T; eq: (col: string, val: string) => T; in: (col: string, vals: string[]) => T }>(
  q: T,
  filters: LedgerFilterParams,
): T {
  if (filters.from) q = q.gte('created_at', filters.from)
  if (filters.to) q = q.lte('created_at', `${filters.to}T23:59:59.999Z`)
  if (filters.type && filters.type !== 'all') {
    if (filters.type === 'invoice') q = q.in('type', ['invoice', 'debit_note'])
    else if (filters.type === 'payment') q = q.in('type', ['payment', 'credit_note'])
    else q = q.eq('type', filters.type)
  }
  return q
}

export async function getSupplierAgingBuckets(supplierId: string, retailerId: string | null): Promise<AgingBucket> {
  const supabase = supabaseServer()
  let q = supabase
    .from('invoices')
    .select('total, issued_at, status')
    .eq('supplier_id', supplierId)
    .in('status', ['issued', 'partial'])
  if (retailerId) q = q.eq('retailer_id', retailerId)
  const { data: invoices } = await q

  const now = Date.now()
  const bucket: AgingBucket = { current: 0, days30_60: 0, days60_90: 0, days90_plus: 0 }
  for (const inv of invoices ?? []) {
    const age = Math.floor((now - new Date(inv.issued_at).getTime()) / 86_400_000)
    const amt = Number(inv.total)
    if (age < 30) bucket.current += amt
    else if (age < 60) bucket.days30_60 += amt
    else if (age < 90) bucket.days60_90 += amt
    else bucket.days90_plus += amt
  }
  bucket.current = roundMoney(bucket.current)
  bucket.days30_60 = roundMoney(bucket.days30_60)
  bucket.days60_90 = roundMoney(bucket.days60_90)
  bucket.days90_plus = roundMoney(bucket.days90_plus)
  return bucket
}

export async function getSupplierRetailerBalances(supplierId: string): Promise<RetailerBalance[]> {
  const supabase = supabaseServer()
  const { data: entries } = await supabase
    .from('ledger_entries')
    .select('retailer_id, amount, type')
    .eq('supplier_id', supplierId)

  if (!entries?.length) return []

  const byRetailer = new Map<string, { invoiced: number; collected: number }>()
  for (const e of entries) {
    const cur = byRetailer.get(e.retailer_id) ?? { invoiced: 0, collected: 0 }
    const amt = Number(e.amount)
    if (e.type === 'invoice' || e.type === 'debit_note') cur.invoiced += amt
    if (e.type === 'payment' || e.type === 'credit_note') cur.collected += -amt
    byRetailer.set(e.retailer_id, cur)
  }

  const retailerIds = [...byRetailer.keys()]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, business_name, name')
    .in('user_id', retailerIds)
  const profMap = new Map((profiles ?? []).map((p) => [p.user_id, p]))

  const result: RetailerBalance[] = retailerIds.map((rid) => {
    const b = byRetailer.get(rid)!
    const p = profMap.get(rid)
    return {
      retailerId: rid,
      retailerName: p?.business_name || p?.name || 'Retailer',
      totalInvoiced: roundMoney(b.invoiced),
      totalCollected: roundMoney(b.collected),
      outstanding: roundMoney(b.invoiced - b.collected),
    }
  })
  result.sort((a, b) => b.outstanding - a.outstanding)
  return result
}

export async function getSupplierLedgerPageData(
  retailerId: string | null,
  options: LedgerLoadOptions = { load: 'page', page: 1 },
  filters: LedgerFilterParams = {},
  retailerBalancesPaging?: { page: number; pageSize: number } | null,
): Promise<LedgerPageData | { error: string }> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: supplier } = await supabase.from('suppliers').select('id, currency_code').eq('user_id', user.id).maybeSingle()
  if (!supplier) return { error: 'Not a supplier' }
  const supplierCurrency = String((supplier as { currency_code?: string }).currency_code ?? 'USD')

  const { data: allEntries } = await supabase
    .from('ledger_entries')
    .select('retailer_id')
    .eq('supplier_id', supplier.id)

  const retailerIds = [...new Set((allEntries ?? []).map((e) => e.retailer_id))]

  let skinnyQ = supabase.from('ledger_entries').select('amount, type').eq('supplier_id', supplier.id)
  if (retailerId) skinnyQ = skinnyQ.eq('retailer_id', retailerId)
  skinnyQ = applyDateTypeFilters(skinnyQ, filters)

  const [{ data: profiles }, { data: skinny, error: skinnyErr }, aging, retailerBalancesAll] = await Promise.all([
    retailerIds.length
      ? supabase.from('profiles').select('user_id, business_name, name').in('user_id', retailerIds)
      : Promise.resolve({ data: [] as { user_id: string; business_name: string | null; name: string | null }[] }),
    skinnyQ,
    getSupplierAgingBuckets(supplier.id, retailerId),
    getSupplierRetailerBalances(supplier.id),
  ])
  if (skinnyErr) return { error: skinnyErr.message }
  const { netBalance, totalInvoiced, totalCollected } = totalsFromSkinny(skinny ?? [])

  const profMap = new Map((profiles ?? []).map((p) => [p.user_id, p]))
  const filterOptions: LedgerFilterOption[] = retailerIds.map((rid) => ({
    id: rid,
    label: profMap.get(rid)?.business_name || profMap.get(rid)?.name || 'Retailer',
  }))
  filterOptions.sort((a, b) => a.label.localeCompare(b.label))

  let retailerBalancesView: RetailerBalance[] = retailerBalancesAll
  let retailerBalancesPagination: LedgerPagination | undefined
  if (retailerBalancesPaging != null) {
    const rbSize = Math.max(1, retailerBalancesPaging.pageSize)
    const rbTotal = retailerBalancesAll.length
    const rbTp = totalPagesFromCount(rbTotal, rbSize)
    const rbEff = clampPageToTotal(retailerBalancesPaging.page, rbTp)
    const rbFrom = (rbEff - 1) * rbSize
    retailerBalancesView = retailerBalancesAll.slice(rbFrom, rbFrom + rbSize)
    retailerBalancesPagination = {
      page: rbEff,
      pageSize: rbSize,
      totalCount: rbTotal,
      totalPages: rbTp,
    }
  }

  let fullQ = supabase
    .from('ledger_entries')
    .select('id, created_at, type, amount, description, retailer_id, reference_id')
    .eq('supplier_id', supplier.id)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (retailerId) fullQ = fullQ.eq('retailer_id', retailerId)
  fullQ = applyDateTypeFilters(fullQ, filters)

  // Fetch notes for entries
  async function fetchNotes(entryIds: string[]): Promise<Map<string, string>> {
    if (!entryIds.length) return new Map()
    const { data } = await supabase
      .from('ledger_entry_notes')
      .select('entry_id, note')
      .in('entry_id', entryIds)
    return new Map((data ?? []).map((n) => [n.entry_id, n.note]))
  }

  function buildRow(
    e: { id: string; created_at: string; type: string; amount: string | number; description: string | null; retailer_id?: string; supplier_id?: string; reference_id: string },
    running: number,
    counterpart: string,
    noteMap: Map<string, string>,
  ): LedgerListRow {
    return {
      id: e.id,
      created_at: e.created_at,
      type: e.type as LedgerEntryType,
      amount: Number(e.amount),
      description: e.description,
      counterpart,
      runningBalance: roundMoney(running),
      reference_id: e.reference_id,
      note: noteMap.get(e.id) ?? null,
      retailer_id: (e as { retailer_id?: string }).retailer_id ?? null,
    }
  }

  if (options.load === 'all') {
    const { data: entries, error } = await fullQ
    if (error) return { error: error.message }
    if (!entries?.length) {
      return {
        rows: [], netBalance, totalInvoiced, totalCollected,
        filterOptions, activeFilterId: retailerId,
        displayCurrency: supplierCurrency,
        aging,
        retailerBalances: retailerBalancesView,
        retailerBalancesPagination,
      }
    }
    const noteMap = await fetchNotes(entries.map((e) => e.id))
    let running = 0
    const rowsAsc: LedgerListRow[] = []
    for (const e of entries) {
      running += Number(e.amount)
      const p = profMap.get(e.retailer_id)
      rowsAsc.push(buildRow(e, running, p?.business_name || p?.name || 'Retailer', noteMap))
    }
    return {
      rows: reverseLedgerDisplayOrder(rowsAsc), netBalance, totalInvoiced, totalCollected,
      filterOptions, activeFilterId: retailerId,
      displayCurrency: supplierCurrency,
      aging,
      retailerBalances: retailerBalancesView,
      retailerBalancesPagination,
    }
  }

  const pageSize = options.pageSize ?? DEFAULT_LEDGER_PAGE_SIZE
  const page = Math.max(1, options.page)

  let countQ = supabase.from('ledger_entries').select('id', { count: 'exact', head: true }).eq('supplier_id', supplier.id)
  if (retailerId) countQ = countQ.eq('retailer_id', retailerId)
  countQ = applyDateTypeFilters(countQ, filters)
  const { count: totalCountRaw, error: countErr } = await countQ
  if (countErr) return { error: countErr.message }
  const totalCount = totalCountRaw ?? 0
  const { from, to, page: safePage, totalPages } = newestFirstRange(totalCount, page, pageSize)

  if (totalCount === 0) {
    return {
      rows: [], netBalance, totalInvoiced, totalCollected,
      filterOptions, activeFilterId: retailerId,
      displayCurrency: supplierCurrency,
      pagination: { page: safePage, pageSize, totalCount, totalPages },
      aging,
      retailerBalances: retailerBalancesView,
      retailerBalancesPagination,
    }
  }

  let priorSum = 0
  if (from > 0) {
    let priorQ = supabase
      .from('ledger_entries')
      .select('amount')
      .eq('supplier_id', supplier.id)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(from)
    if (retailerId) priorQ = priorQ.eq('retailer_id', retailerId)
    priorQ = applyDateTypeFilters(priorQ, filters)
    const { data: priorRows, error: pErr } = await priorQ
    if (pErr) return { error: pErr.message }
    priorSum = (priorRows ?? []).reduce((s, r) => s + Number(r.amount), 0)
  }

  const { data: entries, error } = await fullQ.range(from, to)
  if (error) return { error: error.message }

  const noteMap = await fetchNotes((entries ?? []).map((e) => e.id))
  let running = priorSum
  const rowsAsc: LedgerListRow[] = []
  for (const e of entries ?? []) {
    running += Number(e.amount)
    const p = profMap.get(e.retailer_id)
    rowsAsc.push(buildRow(e, running, p?.business_name || p?.name || 'Retailer', noteMap))
  }

  return {
    rows: reverseLedgerDisplayOrder(rowsAsc), netBalance, totalInvoiced, totalCollected,
    filterOptions, activeFilterId: retailerId,
    displayCurrency: supplierCurrency,
    pagination: { page: safePage, pageSize, totalCount, totalPages },
    aging,
    retailerBalances: retailerBalancesView,
    retailerBalancesPagination,
  }
}

export async function getRetailerLedgerPageData(
  supplierId: string | null,
  options: LedgerLoadOptions = { load: 'page', page: 1 },
): Promise<LedgerPageData | { error: string }> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: allEntries } = await supabase.from('ledger_entries').select('supplier_id').eq('retailer_id', user.id)

  const supplierIds = [...new Set((allEntries ?? []).map((e) => e.supplier_id))]
  const { data: suppliers } = await supabase.from('suppliers').select('id, user_id, currency_code').in('id', supplierIds)
  const userIds = [...new Set((suppliers ?? []).map((s) => s.user_id))]
  const { data: profiles } = await supabase.from('profiles').select('user_id, business_name').in('user_id', userIds)
  const profByUser = new Map((profiles ?? []).map((p) => [p.user_id, p]))
  const labelBySupplierId = new Map<string, string>()
  const currencyBySupplierId = new Map<string, string>()
  for (const s of suppliers ?? []) {
    const p = profByUser.get(s.user_id)
    labelBySupplierId.set(s.id, p?.business_name ?? 'Supplier')
    currencyBySupplierId.set(s.id, String((s as { currency_code?: string }).currency_code ?? 'USD'))
  }

  let displayCurrency = 'USD'
  if (supplierId) {
    displayCurrency = currencyBySupplierId.get(supplierId) ?? 'USD'
  } else {
    const conv = await loadCurrencyConversionState(supabase)
    if (!('error' in conv)) displayCurrency = conv.defaultCurrency
  }

  const filterOptions: LedgerFilterOption[] = supplierIds.map((sid) => ({
    id: sid,
    label: labelBySupplierId.get(sid) ?? 'Supplier',
  }))
  filterOptions.sort((a, b) => a.label.localeCompare(b.label))

  let skinnyQ = supabase.from('ledger_entries').select('amount, type').eq('retailer_id', user.id)
  if (supplierId) skinnyQ = skinnyQ.eq('supplier_id', supplierId)
  const { data: skinny, error: skinnyErr } = await skinnyQ
  if (skinnyErr) return { error: skinnyErr.message }
  const { netBalance, totalInvoiced, totalCollected } = totalsFromSkinny(skinny ?? [])

  let fullQ = supabase
    .from('ledger_entries')
    .select('id, created_at, type, amount, description, supplier_id, reference_id')
    .eq('retailer_id', user.id)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (supplierId) fullQ = fullQ.eq('supplier_id', supplierId)

  if (options.load === 'all') {
    const { data: entries, error } = await fullQ
    if (error) return { error: error.message }
    if (!entries?.length) {
      return {
        rows: [], netBalance, totalInvoiced, totalCollected,
        filterOptions, activeFilterId: supplierId, displayCurrency,
      }
    }
    let running = 0
    const rowsAsc: LedgerListRow[] = []
    for (const e of entries) {
      const amt = Number(e.amount)
      running += amt
      rowsAsc.push({
        id: e.id, created_at: e.created_at,
        type: e.type as LedgerEntryType, amount: amt,
        description: e.description,
        counterpart: labelBySupplierId.get(e.supplier_id) ?? 'Supplier',
        runningBalance: roundMoney(running),
        reference_id: e.reference_id,
      })
    }
    const enrichedRows = await enrichLedgerRowsWithPaymentDetails(supabase, rowsAsc)
    return {
      rows: reverseLedgerDisplayOrder(enrichedRows), netBalance, totalInvoiced, totalCollected,
      filterOptions, activeFilterId: supplierId, displayCurrency,
    }
  }

  const pageSize = options.pageSize ?? DEFAULT_LEDGER_PAGE_SIZE
  const page = Math.max(1, options.page)

  let countQ = supabase.from('ledger_entries').select('id', { count: 'exact', head: true }).eq('retailer_id', user.id)
  if (supplierId) countQ = countQ.eq('supplier_id', supplierId)
  const { count: totalCountRaw, error: countErr } = await countQ
  if (countErr) return { error: countErr.message }
  const totalCount = totalCountRaw ?? 0
  const { from, to, page: safePage, totalPages } = newestFirstRange(totalCount, page, pageSize)

  if (totalCount === 0) {
    return {
      rows: [], netBalance, totalInvoiced, totalCollected,
      filterOptions, activeFilterId: supplierId, displayCurrency,
      pagination: { page: safePage, pageSize, totalCount, totalPages },
    }
  }

  let priorSum = 0
  if (from > 0) {
    let priorQ = supabase
      .from('ledger_entries')
      .select('amount')
      .eq('retailer_id', user.id)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(from)
    if (supplierId) priorQ = priorQ.eq('supplier_id', supplierId)
    const { data: priorRows, error: pErr } = await priorQ
    if (pErr) return { error: pErr.message }
    priorSum = (priorRows ?? []).reduce((s, r) => s + Number(r.amount), 0)
  }

  const { data: entries, error } = await fullQ.range(from, to)
  if (error) return { error: error.message }

  let running = priorSum
  const rowsAsc: LedgerListRow[] = []
  for (const e of entries ?? []) {
    const amt = Number(e.amount)
    running += amt
    rowsAsc.push({
      id: e.id, created_at: e.created_at,
      type: e.type as LedgerEntryType, amount: amt,
      description: e.description,
      counterpart: labelBySupplierId.get(e.supplier_id) ?? 'Supplier',
      runningBalance: roundMoney(running),
      reference_id: e.reference_id,
    })
  }

  const enrichedRows = await enrichLedgerRowsWithPaymentDetails(supabase, rowsAsc)

  return {
    rows: reverseLedgerDisplayOrder(enrichedRows), netBalance, totalInvoiced, totalCollected,
    filterOptions, activeFilterId: supplierId, displayCurrency,
    pagination: { page: safePage, pageSize, totalCount, totalPages },
  }
}

export async function getSupplierLedger(): Promise<
  { rows: LedgerListRow[]; netBalance: number } | { error: string }
> {
  const r = await getSupplierLedgerPageData(null, { load: 'page', page: 1 })
  if ('error' in r) return r
  return { rows: r.rows, netBalance: r.netBalance }
}

export async function getRetailerLedger(): Promise<
  { rows: LedgerListRow[]; netBalance: number } | { error: string }
> {
  const r = await getRetailerLedgerPageData(null, { load: 'page', page: 1 })
  if ('error' in r) return r
  return { rows: r.rows, netBalance: r.netBalance }
}
