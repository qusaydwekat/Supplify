import 'server-only'

import { supabaseServer } from '@/lib/supabase/server'
import type { VariationMovementRow } from '@/lib/types/products'

type RpcMovementRow = {
  id: string
  movement_type: string
  quantity: number
  adjustment_increase: boolean
  reference_type: string
  notes: string | null
  created_at: string
  stock_after: number
  total_count: number
}

export async function listVariationMovements(
  variationId: string,
  page = 1,
  pageSize = 15,
): Promise<{ rows: VariationMovementRow[]; total: number; error?: string }> {
  const supabase = supabaseServer()
  const offset = (Math.max(1, page) - 1) * pageSize

  const { data, error } = await supabase.rpc('supplier_variation_movements_paged', {
    p_variation_id: variationId,
    p_limit: pageSize,
    p_offset: offset,
  })

  if (error) return { rows: [], total: 0, error: error.message }

  const raw = (data ?? []) as RpcMovementRow[]
  const rows: VariationMovementRow[] = raw.map((r) => ({
    id: r.id,
    movementType: r.movement_type,
    quantity: r.quantity,
    adjustmentIncrease: r.adjustment_increase,
    referenceType: r.reference_type,
    notes: r.notes,
    createdAt: r.created_at,
    stockAfter: r.stock_after,
  }))

  return { rows, total: Number(raw[0]?.total_count ?? 0) }
}

export async function listProductMovements(
  productId: string,
  pageSize = 20,
): Promise<{ rows: (VariationMovementRow & { variationName: string })[]; error?: string }> {
  const supabase = supabaseServer()

  const { data: variations, error: vErr } = await supabase
    .from('product_variations')
    .select('id, name')
    .eq('product_id', productId)
    .order('created_at', { ascending: true })

  if (vErr) return { rows: [], error: vErr.message }

  const merged: (VariationMovementRow & { variationName: string })[] = []

  for (const v of variations ?? []) {
    const res = await listVariationMovements(v.id, 1, pageSize)
    if (res.error) return { rows: [], error: res.error }
    for (const row of res.rows) {
      merged.push({ ...row, variationName: v.name })
    }
  }

  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return { rows: merged.slice(0, pageSize) }
}
