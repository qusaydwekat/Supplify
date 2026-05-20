import 'server-only'

import { supabaseServer } from '@/lib/supabase/server'
import type { ProductListFilters } from '@/lib/types/products'

type ExportRow = {
  product_name: string
  marketplace_category: string | null
  is_active: boolean
  variation_name: string
  sku: string | null
  cost_price: number
  price: number
  stock_quantity: number
  min_order_quantity: number
  reorder_point: number | null
  reorder_qty: number | null
}

export async function fetchProductsForExport(
  filters: Omit<ProductListFilters, 'page' | 'pageSize' | 'sort'>,
): Promise<{ rows: ExportRow[]; error?: string }> {
  const supabase = supabaseServer()
  const limit = 2000
  let offset = 0
  const allProducts: {
    id: string
    name: string
    marketplace_category: string | null
    is_active: boolean
  }[] = []

  for (;;) {
    const { data, error } = await supabase.rpc('supplier_products_paged', {
      p_limit: limit,
      p_offset: offset,
      p_search: filters.search?.trim() || null,
      p_marketplace_category: filters.marketplaceCategory?.trim() || null,
      p_status: filters.status ?? 'all',
      p_low_stock_only: filters.lowStockOnly ?? false,
      p_sort: 'name_asc',
    })
    if (error) return { rows: [], error: error.message }
    const batch = (data ?? []) as { id: string; name: string; marketplace_category: string | null; is_active: boolean; total_count: number }[]
    if (!batch.length) break
    allProducts.push(
      ...batch.map((r) => ({
        id: r.id,
        name: r.name,
        marketplace_category: r.marketplace_category,
        is_active: r.is_active,
      })),
    )
    if (batch.length < limit) break
    offset += limit
  }

  if (!allProducts.length) return { rows: [] }

  const productIds = allProducts.map((p) => p.id)
  const { data: vars, error: vErr } = await supabase
    .from('product_variations')
    .select(
      'product_id, name, sku, cost_price, price, stock_quantity, min_order_quantity, reorder_point, reorder_qty',
    )
    .in('product_id', productIds)
    .order('created_at', { ascending: true })

  if (vErr) return { rows: [], error: vErr.message }

  const byProduct = new Map(allProducts.map((p) => [p.id, p]))
  const rows: ExportRow[] = (vars ?? []).map((v) => {
    const p = byProduct.get(v.product_id)!
    return {
      product_name: p.name,
      marketplace_category: p.marketplace_category,
      is_active: p.is_active,
      variation_name: v.name,
      sku: v.sku,
      cost_price: Number(v.cost_price ?? 0),
      price: Number(v.price),
      stock_quantity: Number(v.stock_quantity),
      min_order_quantity: Number(v.min_order_quantity),
      reorder_point: (v as { reorder_point?: number | null }).reorder_point ?? null,
      reorder_qty: (v as { reorder_qty?: number | null }).reorder_qty ?? null,
    }
  })

  return { rows }
}

function csvEscape(s: string) {
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function productsExportToCsv(rows: ExportRow[]): string {
  const header = [
    'product_name',
    'marketplace_category',
    'is_active',
    'variation_name',
    'sku',
    'cost_price',
    'price',
    'stock_quantity',
    'min_order_quantity',
    'reorder_point',
    'reorder_qty',
  ].join(',')
  const lines = rows.map((r) =>
    [
      csvEscape(r.product_name),
      csvEscape(r.marketplace_category ?? ''),
      r.is_active ? 'yes' : 'no',
      csvEscape(r.variation_name),
      csvEscape(r.sku ?? ''),
      r.cost_price.toFixed(2),
      r.price.toFixed(2),
      String(r.stock_quantity),
      String(r.min_order_quantity),
      r.reorder_point == null ? '' : String(r.reorder_point),
      r.reorder_qty == null ? '' : String(r.reorder_qty),
    ].join(','),
  )
  return `${header}\n${lines.join('\n')}`
}
