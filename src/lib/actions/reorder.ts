'use server'

import { supabaseServer } from '@/lib/supabase/server'
import { VARIATION_PUBLIC_COLUMNS } from '@/lib/utils'
import type { CartItem } from '@/types/cart'
import { orderRowsNewestFirst } from '@/lib/data/order-sort'

export type ReorderPayloadResult = {
  error: string | null
  items: CartItem[] | null
  supplierId: string | null
  supplierLabel: string | null
  supplierCurrency: string | null
  warnings: string[]
}

type OrderLineRow = {
  product_id: string
  variation_id: string | null
  product_name: string
  variation_name: string | null
  quantity: number
}

async function supplierLabelForId(
  supabase: ReturnType<typeof supabaseServer>,
  supplierId: string,
): Promise<string> {
  const { data: sup } = await supabase.from('suppliers').select('user_id').eq('id', supplierId).maybeSingle()
  if (!sup) return 'Supplier'
  const { data: profile } = await supabase.from('profiles').select('business_name').eq('user_id', sup.user_id).maybeSingle()
  return profile?.business_name ?? 'Supplier'
}

async function cartItemsFromOrderLines(
  supabase: ReturnType<typeof supabaseServer>,
  orderSupplierId: string,
  lines: OrderLineRow[],
): Promise<{ items: CartItem[]; warnings: string[]; supplierCurrency: string }> {
  const { data: supRow } = await supabase.from('suppliers').select('currency_code').eq('id', orderSupplierId).maybeSingle()
  const supplierCurrency = String((supRow as { currency_code?: string } | null)?.currency_code ?? 'USD')

  const variationIds = lines.map((l) => l.variation_id).filter(Boolean) as string[]
  if (!variationIds.length) {
    return { items: [], warnings: ['No line items with variations'], supplierCurrency }
  }

  const { data: vars, error: vErr } = await supabase
    .from('product_variations')
    .select(VARIATION_PUBLIC_COLUMNS)
    .in('id', variationIds)

  if (vErr || !vars?.length) {
    return { items: [], warnings: [vErr?.message ?? 'Could not load variations'], supplierCurrency }
  }

  const productIds = [...new Set(vars.map((v) => v.product_id))]
  const { data: prods } = await supabase.from('products').select('id, name, supplier_id, is_active').in('id', productIds)
  const prodMap = new Map((prods ?? []).map((p) => [p.id, p]))
  const varMap = new Map(vars.map((v) => [v.id, v]))
  const warnings: string[] = []
  const items: CartItem[] = []

  for (const line of lines) {
    if (!line.variation_id) {
      warnings.push(`${line.product_name}: skipped (no variation on line)`)
      continue
    }
    const v = varMap.get(line.variation_id)
    const prod = v ? prodMap.get(v.product_id) : undefined
    if (!v || !prod) {
      warnings.push(`${line.product_name}: variation no longer available`)
      continue
    }
    if (prod.supplier_id !== orderSupplierId) {
      warnings.push(`${line.product_name}: product moved to another supplier`)
      continue
    }
    if (!v.is_active || !prod.is_active) {
      warnings.push(`${line.product_name}: currently inactive`)
      continue
    }

    const stock = Number(v.stock_quantity)
    const qty = line.quantity
    if (stock <= 0) {
      warnings.push(`${line.product_name}: out of stock — skipped`)
      continue
    }

    const useQty = Math.min(qty, stock)
    if (useQty < qty) {
      warnings.push(`${line.product_name}: only ${useQty} in stock (was ${qty})`)
    }

    const minOrder = Number(v.min_order_quantity)
    if (useQty < minOrder) {
      warnings.push(`${line.product_name}: need at least ${minOrder} to order — skipped`)
      continue
    }

    items.push({
      variationId: v.id,
      productId: prod.id,
      supplierId: orderSupplierId,
      supplierCurrency,
      productName: prod.name,
      variationName: line.variation_name,
      quantity: useQty,
      unitPrice: Number(v.price),
    })
  }

  return { items, warnings, supplierCurrency }
}

export async function getReorderCartPayload(orderId: string): Promise<ReorderPayloadResult> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized', items: null, supplierId: null, supplierLabel: null, supplierCurrency: null, warnings: [] }
  }

  const { data: roleRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (roleRow?.role !== 'retailer') {
    return {
      error: 'Only retailers can reorder',
      items: null,
      supplierId: null,
      supplierLabel: null,
      supplierCurrency: null,
      warnings: [],
    }
  }

  const { data: order, error: oErr } = await supabase
    .from('orders')
    .select('id, retailer_id, supplier_id, status')
    .eq('id', orderId)
    .maybeSingle()

  if (oErr || !order) {
    return { error: 'Order not found', items: null, supplierId: null, supplierLabel: null, supplierCurrency: null, warnings: [] }
  }
  if (order.retailer_id !== user.id) {
    return { error: 'Forbidden', items: null, supplierId: null, supplierLabel: null, supplierCurrency: null, warnings: [] }
  }
  if (order.status !== 'delivered') {
    return {
      error: 'Reorder is only available for delivered orders',
      items: null,
      supplierId: null,
      supplierLabel: null,
      supplierCurrency: null,
      warnings: [],
    }
  }

  const { data: lines, error: lErr } = await supabase
    .from('order_items')
    .select('product_id, variation_id, product_name, variation_name, quantity')
    .eq('order_id', orderId)

  if (lErr || !lines?.length) {
    return {
      error: lErr?.message ?? 'No line items',
      items: null,
      supplierId: null,
      supplierLabel: null,
      supplierCurrency: null,
      warnings: [],
    }
  }

  const { items, warnings, supplierCurrency } = await cartItemsFromOrderLines(
    supabase,
    order.supplier_id,
    lines as OrderLineRow[],
  )

  if (!items.length) {
    return {
      error: 'No items could be added to the cart. Check stock and product status.',
      items: null,
      supplierId: null,
      supplierLabel: null,
      supplierCurrency: null,
      warnings,
    }
  }

  const supplierLabel = await supplierLabelForId(supabase, order.supplier_id)

  return {
    error: null,
    items,
    supplierId: order.supplier_id,
    supplierLabel,
    supplierCurrency,
    warnings,
  }
}

export async function getReorderCartPayloadForProduct(
  supplierId: string,
  productId: string,
): Promise<ReorderPayloadResult> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized', items: null, supplierId: null, supplierLabel: null, supplierCurrency: null, warnings: [] }
  }

  const { data: roleRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (roleRow?.role !== 'retailer') {
    return {
      error: 'Only retailers can reorder',
      items: null,
      supplierId: null,
      supplierLabel: null,
      supplierCurrency: null,
      warnings: [],
    }
  }

  const { data: oiRefs } = await supabase.from('order_items').select('order_id').eq('product_id', productId)

  const candidateOrderIds = [...new Set((oiRefs ?? []).map((r) => r.order_id))]
  if (!candidateOrderIds.length) {
    return {
      error: 'No delivered order found for this product from this supplier.',
      items: null,
      supplierId: null,
      supplierLabel: null,
      supplierCurrency: null,
      warnings: [],
    }
  }

  const { data: latestOrder } = await orderRowsNewestFirst(
    supabase
      .from('orders')
      .select('id, supplier_id')
      .in('id', candidateOrderIds)
      .eq('retailer_id', user.id)
      .eq('supplier_id', supplierId)
      .eq('status', 'delivered'),
  )
    .limit(1)
    .maybeSingle()

  const orderSupplierId = latestOrder?.supplier_id ?? null
  const orderId = latestOrder?.id ?? null

  const { data: chosenLinesRaw } = orderId
    ? await supabase
        .from('order_items')
        .select('product_id, variation_id, product_name, variation_name, quantity')
        .eq('order_id', orderId)
        .eq('product_id', productId)
    : { data: null as OrderLineRow[] | null }

  const chosenLines = (chosenLinesRaw ?? null) as OrderLineRow[] | null

  if (!orderSupplierId || !chosenLines?.length) {
    return {
      error: 'No delivered order found for this product from this supplier.',
      items: null,
      supplierId: null,
      supplierLabel: null,
      supplierCurrency: null,
      warnings: [],
    }
  }

  const { items, warnings, supplierCurrency } = await cartItemsFromOrderLines(supabase, orderSupplierId, chosenLines)

  if (!items.length) {
    return {
      error: 'Nothing from that order can be added now (stock or catalog changes).',
      items: null,
      supplierId: null,
      supplierLabel: null,
      supplierCurrency: null,
      warnings,
    }
  }

  const supplierLabel = await supplierLabelForId(supabase, orderSupplierId)

  return {
    error: null,
    items,
    supplierId: orderSupplierId,
    supplierLabel,
    supplierCurrency,
    warnings,
  }
}
