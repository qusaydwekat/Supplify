import type { SupabaseClient } from '@supabase/supabase-js'

/** Sync stock cache via inventory_movements (trigger updates product_variations.stock_quantity). */
export async function applyStockDeltaViaMovement(
  supabase: SupabaseClient,
  args: {
    supplierId: string
    variationId: string
    previousQty: number
    targetQty: number
    referenceType: string
    referenceId: string
    notes?: string | null
  },
): Promise<{ error: string | null }> {
  const delta = args.targetQty - args.previousQty
  if (delta === 0) return { error: null }
  if (args.targetQty < 0) return { error: 'Stock cannot be negative' }

  const abs = Math.abs(delta)
  const increases = delta > 0

  const { error } = await supabase.from('inventory_movements').insert({
    supplier_id: args.supplierId,
    product_variation_id: args.variationId,
    type: 'adjustment',
    quantity: abs,
    adjustment_increase: increases,
    reference_type: args.referenceType,
    reference_id: args.referenceId,
    notes: args.notes ?? null,
  })

  if (error) return { error: error.message }
  return { error: null }
}
