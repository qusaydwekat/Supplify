import { supabaseServer } from '@/lib/supabase/server'
import { orderStatuses, type OrderStatus } from '@/lib/validations/order'
import { totalPagesFromCount, type PaginatedResult } from '@/lib/data/pagination'
import { orderRowsNewestFirst } from '@/lib/data/order-sort'

export type OrderListRow = {
  id: string
  created_at: string
  status: OrderStatus
  total_price: number
  currency_code: string
  counterparty: string
  preview: string
}

export type OrderItemRow = {
  id: string
  product_name: string
  variation_name: string | null
  quantity: number
  unit_price: number
  total_price: number
}

export type OrderDetail = {
  id: string
  created_at: string
  updated_at: string
  status: OrderStatus
  total_price: number
  currency_code: string
  notes: string | null
  retailer_id: string
  supplier_id: string
  delivery_person_id: string | null
  is_cod: boolean
  items: OrderItemRow[]
  retailerProfile: { name: string; business_name: string; phone: string | null; city: string | null }
  supplierStore: { business_name: string; id: string }
  deliveryPerson: { id: string; name: string; phone: string } | null
}

async function previewsForOrders(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  orderIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!orderIds.length) return map
  const { data: lines } = await supabase
    .from('order_items')
    .select('order_id, product_name, variation_name')
    .in('order_id', orderIds)
  if (!lines) return map
  const byOrder = new Map<string, string[]>()
  for (const row of lines) {
    const label = row.variation_name ? `${row.product_name} (${row.variation_name})` : row.product_name
    const arr = byOrder.get(row.order_id) ?? []
    arr.push(label)
    byOrder.set(row.order_id, arr)
  }
  for (const [oid, labels] of byOrder) {
    const text = labels.slice(0, 2).join(', ') + (labels.length > 2 ? ` +${labels.length - 2}` : '')
    map.set(oid, text)
  }
  return map
}

export type SupplierOrderListFilters = {
  status?: string | null
  search?: string | null
  dateFrom?: string | null
  dateTo?: string | null
}

function startOfDayIso(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function endOfDayIso(dateStr: string) {
  const d = new Date(dateStr + 'T23:59:59.999')
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export async function getSupplierOrderList(
  opts: { page: number; pageSize: number } & SupplierOrderListFilters,
): Promise<PaginatedResult<OrderListRow> | { error: string }> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: supplier } = await supabase.from('suppliers').select('id, currency_code').eq('user_id', user.id).maybeSingle()
  if (!supplier) return { error: 'Not a supplier' }
  const supplierCurrency = String((supplier as { currency_code?: string }).currency_code ?? 'USD')

  const from = (opts.page - 1) * opts.pageSize
  const to = from + opts.pageSize - 1

  let orderQuery = supabase
    .from('orders')
    .select('id, created_at, status, total_price, retailer_id', { count: 'exact' })
    .eq('supplier_id', supplier.id)

  const statusFilter = opts.status?.trim()
  if (statusFilter && orderStatuses.includes(statusFilter as OrderStatus)) {
    orderQuery = orderQuery.eq('status', statusFilter)
  }

  const fromIso = opts.dateFrom?.trim() ? startOfDayIso(opts.dateFrom.trim()) : null
  if (fromIso) orderQuery = orderQuery.gte('created_at', fromIso)
  const toIso = opts.dateTo?.trim() ? endOfDayIso(opts.dateTo.trim()) : null
  if (toIso) orderQuery = orderQuery.lte('created_at', toIso)

  const search = opts.search?.trim()
  if (search) {
    const { data: retailerRows, error: rErr } = await supabase
      .from('orders')
      .select('retailer_id')
      .eq('supplier_id', supplier.id)
    if (rErr) return { error: rErr.message }
    const retailerScope = [...new Set((retailerRows ?? []).map((r) => r.retailer_id as string))]
    if (!retailerScope.length) {
      return {
        rows: [],
        page: opts.page,
        pageSize: opts.pageSize,
        totalCount: 0,
        totalPages: totalPagesFromCount(0, opts.pageSize),
      }
    }
    const { data: profs, error: pErr } = await supabase
      .from('profiles')
      .select('user_id, business_name, name')
      .in('user_id', retailerScope)
    if (pErr) return { error: pErr.message }
    const needle = search.toLowerCase()
    const matchedRetailers = (profs ?? [])
      .filter((p) => {
        const bn = (p.business_name ?? '').toLowerCase()
        const nm = (p.name ?? '').toLowerCase()
        return bn.includes(needle) || nm.includes(needle)
      })
      .map((p) => p.user_id as string)
    if (!matchedRetailers.length) {
      return {
        rows: [],
        page: opts.page,
        pageSize: opts.pageSize,
        totalCount: 0,
        totalPages: totalPagesFromCount(0, opts.pageSize),
      }
    }
    orderQuery = orderQuery.in('retailer_id', matchedRetailers)
  }

  const { data: orders, error, count } = await orderRowsNewestFirst(orderQuery).range(from, to)

  if (error) return { error: error.message }

  const totalCount = count ?? 0
  const totalPages = totalPagesFromCount(totalCount, opts.pageSize)
  if (!orders?.length) {
    return { rows: [], page: opts.page, pageSize: opts.pageSize, totalCount, totalPages }
  }

  const retailerIds = [...new Set(orders.map((o) => o.retailer_id))]
  const { data: profiles } = await supabase.from('profiles').select('user_id, name, business_name').in('user_id', retailerIds)

  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]))
  const orderIds = orders.map((o) => o.id)
  const previewMap = await previewsForOrders(supabase, orderIds)

  const rows: OrderListRow[] = orders.map((o) => {
    const p = profileMap.get(o.retailer_id)
    const counterparty = p?.business_name || p?.name || 'Retailer'
    return {
      id: o.id,
      created_at: o.created_at,
      status: o.status as OrderStatus,
      total_price: Number(o.total_price),
      currency_code: supplierCurrency,
      counterparty,
      preview: previewMap.get(o.id) ?? '—',
    }
  })

  return { rows, page: opts.page, pageSize: opts.pageSize, totalCount, totalPages }
}

export async function getRetailerOrderList(opts: {
  page: number
  pageSize: number
}): Promise<PaginatedResult<OrderListRow> | { error: string }> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const from = (opts.page - 1) * opts.pageSize
  const to = from + opts.pageSize - 1

  const { data: orders, error, count } = await orderRowsNewestFirst(
    supabase
      .from('orders')
      .select('id, created_at, status, total_price, supplier_id', { count: 'exact' })
      .eq('retailer_id', user.id),
  ).range(from, to)

  if (error) return { error: error.message }

  const totalCount = count ?? 0
  const totalPages = totalPagesFromCount(totalCount, opts.pageSize)
  if (!orders?.length) {
    return { rows: [], page: opts.page, pageSize: opts.pageSize, totalCount, totalPages }
  }

  const supplierIds = [...new Set(orders.map((o) => o.supplier_id))]
  const { data: suppliers } = await supabase.from('suppliers').select('id, user_id, currency_code').in('id', supplierIds)
  const supUserIds = [...new Set((suppliers ?? []).map((s) => s.user_id))]
  const { data: supProfiles } = await supabase.from('profiles').select('user_id, business_name').in('user_id', supUserIds)
  const profileByUser = new Map((supProfiles ?? []).map((p) => [p.user_id, p]))
  const supMap = new Map<string, string>()
  const supCcy = new Map<string, string>()
  for (const s of suppliers ?? []) {
    const p = profileByUser.get(s.user_id)
    supMap.set(s.id, p?.business_name ?? 'Supplier')
    supCcy.set(s.id, String((s as { currency_code?: string }).currency_code ?? 'USD'))
  }
  const orderIds = orders.map((o) => o.id)
  const previewMap = await previewsForOrders(supabase, orderIds)

  const rows: OrderListRow[] = orders.map((o) => {
    const counterparty = supMap.get(o.supplier_id) ?? 'Supplier'
    return {
      id: o.id,
      created_at: o.created_at,
      status: o.status as OrderStatus,
      total_price: Number(o.total_price),
      currency_code: supCcy.get(o.supplier_id) ?? 'USD',
      counterparty,
      preview: previewMap.get(o.id) ?? '—',
    }
  })

  return { rows, page: opts.page, pageSize: opts.pageSize, totalCount, totalPages }
}

export async function getSupplierOrderDetail(orderId: string): Promise<{ order: OrderDetail } | { error: string }> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: supplier } = await supabase.from('suppliers').select('id, user_id, currency_code').eq('user_id', user.id).maybeSingle()
  if (!supplier) return { error: 'Not a supplier' }
  const supplierCurrency = String((supplier as { currency_code?: string }).currency_code ?? 'USD')

  const { data: order, error: oErr } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle()
  if (oErr || !order) return { error: oErr?.message ?? 'Order not found' }
  if (order.supplier_id !== supplier.id) return { error: 'Forbidden' }

  const delivery_person_id = (order as { delivery_person_id?: string | null }).delivery_person_id ?? null
  let deliveryPerson: { id: string; name: string; phone: string } | null = null
  if (delivery_person_id) {
    const { data: dp } = await supabase
      .from('delivery_persons')
      .select('id, name, phone')
      .eq('id', delivery_person_id)
      .maybeSingle()
    if (dp) deliveryPerson = dp
  }

  const { data: items, error: iErr } = await supabase
    .from('order_items')
    .select('id, product_name, variation_name, quantity, unit_price, total_price')
    .eq('order_id', orderId)
    .order('id')

  if (iErr || !items) return { error: iErr?.message ?? 'Could not load items' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, business_name, phone, city')
    .eq('user_id', order.retailer_id)
    .maybeSingle()

  const { data: ownProfile } = await supabase
    .from('profiles')
    .select('business_name')
    .eq('user_id', supplier.user_id)
    .maybeSingle()

  return {
    order: {
      id: order.id,
      created_at: order.created_at,
      updated_at: order.updated_at,
      status: order.status as OrderStatus,
      total_price: Number(order.total_price),
      currency_code: supplierCurrency,
      notes: order.notes,
      retailer_id: order.retailer_id,
      supplier_id: order.supplier_id,
      delivery_person_id,
      is_cod: !!(order as { is_cod?: boolean }).is_cod,
      items: items.map((i) => ({
        id: i.id,
        product_name: i.product_name,
        variation_name: i.variation_name,
        quantity: i.quantity,
        unit_price: Number(i.unit_price),
        total_price: Number(i.total_price),
      })),
      retailerProfile: {
        name: profile?.name ?? '—',
        business_name: profile?.business_name ?? '—',
        phone: profile?.phone ?? null,
        city: profile?.city ?? null,
      },
      supplierStore: { business_name: ownProfile?.business_name ?? 'Your store', id: supplier.id },
      deliveryPerson,
    },
  }
}

export async function getRetailerOrderDetail(orderId: string): Promise<{ order: OrderDetail } | { error: string }> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: order, error: oErr } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle()
  if (oErr || !order) return { error: oErr?.message ?? 'Order not found' }
  if (order.retailer_id !== user.id) return { error: 'Forbidden' }

  const delivery_person_id = (order as { delivery_person_id?: string | null }).delivery_person_id ?? null
  let deliveryPerson: { id: string; name: string; phone: string } | null = null
  if (delivery_person_id) {
    const { data: dp } = await supabase
      .from('delivery_persons')
      .select('id, name, phone')
      .eq('id', delivery_person_id)
      .maybeSingle()
    if (dp) deliveryPerson = dp
  }

  const { data: items, error: iErr } = await supabase
    .from('order_items')
    .select('id, product_name, variation_name, quantity, unit_price, total_price')
    .eq('order_id', orderId)
    .order('id')

  if (iErr || !items) return { error: iErr?.message ?? 'Could not load items' }

  const { data: sup } = await supabase.from('suppliers').select('id, user_id, currency_code').eq('id', order.supplier_id).maybeSingle()
  const { data: supProfile } = sup
    ? await supabase.from('profiles').select('business_name').eq('user_id', sup.user_id).maybeSingle()
    : { data: null }
  const retailerOrderCurrency = String((sup as { currency_code?: string } | null)?.currency_code ?? 'USD')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, business_name, phone, city')
    .eq('user_id', order.retailer_id)
    .maybeSingle()

  return {
    order: {
      id: order.id,
      created_at: order.created_at,
      updated_at: order.updated_at,
      status: order.status as OrderStatus,
      total_price: Number(order.total_price),
      currency_code: retailerOrderCurrency,
      notes: order.notes,
      retailer_id: order.retailer_id,
      supplier_id: order.supplier_id,
      delivery_person_id,
      is_cod: !!(order as { is_cod?: boolean }).is_cod,
      items: items.map((i) => ({
        id: i.id,
        product_name: i.product_name,
        variation_name: i.variation_name,
        quantity: i.quantity,
        unit_price: Number(i.unit_price),
        total_price: Number(i.total_price),
      })),
      retailerProfile: {
        name: profile?.name ?? '—',
        business_name: profile?.business_name ?? '—',
        phone: profile?.phone ?? null,
        city: profile?.city ?? null,
      },
      supplierStore: { business_name: supProfile?.business_name ?? 'Supplier', id: order.supplier_id },
      deliveryPerson,
    },
  }
}

export { formatMoney } from '@/lib/format-money'
