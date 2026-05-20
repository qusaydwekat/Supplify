'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { applyPurchaseMovement } from '@/lib/services/inventory/apply-stock-delta'
import { supabaseServer } from '@/lib/supabase/server'
import { resolveSupplierAccess } from '@/lib/supplier/access'

const receiveLineSchema = z.object({
  variationId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
})

const receiveStockSchema = z.object({
  referenceNote: z.string().max(200).optional().or(z.literal('')),
  lines: z.array(receiveLineSchema).min(1),
})

export async function receiveStock(input: unknown) {
  const parsed = receiveStockSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.message, received: 0 }

  const ctx = await resolveSupplierAccess()
  if (ctx.error || !ctx.access) return { error: ctx.error ?? 'Unauthorized', received: 0 }
  if (!ctx.access.canAdjustInventory) {
    return { error: 'You do not have permission to receive stock', received: 0 }
  }

  const supabase = supabaseServer()
  const { supplierId } = ctx.access
  const batchId = randomUUID()
  const note = parsed.data.referenceNote?.trim() || null

  const variationIds = parsed.data.lines.map((l) => l.variationId)
  const { data: vars, error: vErr } = await supabase
    .from('product_variations')
    .select('id, product_id')
    .in('id', variationIds)

  if (vErr || !vars?.length) return { error: vErr?.message ?? 'Variations not found', received: 0 }

  const productIds = [...new Set(vars.map((v) => v.product_id))]
  const { data: products, error: pErr } = await supabase
    .from('products')
    .select('id')
    .in('id', productIds)
    .eq('supplier_id', supplierId)

  if (pErr) return { error: pErr.message, received: 0 }
  const allowedVarIds = new Set(
    vars.filter((v) => (products ?? []).some((p) => p.id === v.product_id)).map((v) => v.id),
  )

  let received = 0
  for (const line of parsed.data.lines) {
    if (!allowedVarIds.has(line.variationId)) {
      return { error: 'One or more SKUs do not belong to your catalog', received }
    }

    const res = await applyPurchaseMovement(supabase, {
      supplierId,
      variationId: line.variationId,
      quantity: line.quantity,
      referenceId: batchId,
      notes: note,
    })
    if (res.error) return { error: res.error, received }
    received += line.quantity
  }

  revalidatePath('/supplier/inventory/receive')
  revalidatePath('/supplier/inventory-insights')
  revalidatePath('/supplier/products')
  revalidatePath('/supplier')
  return { error: null, received }
}

export async function searchSupplierSkusForReceive(query: string) {
  const ctx = await resolveSupplierAccess()
  if (ctx.error || !ctx.access) return { rows: [], error: ctx.error ?? 'Unauthorized' }

  const supabase = supabaseServer()
  const q = query.trim()
  if (!q) return { rows: [], error: null }

  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .eq('supplier_id', ctx.access.supplierId)
    .ilike('name', `%${q}%`)
    .limit(20)

  const productIds = (products ?? []).map((p) => p.id)
  if (!productIds.length) return { rows: [], error: null }

  const { data: vars, error } = await supabase
    .from('product_variations')
    .select('id, name, sku, stock_quantity, product_id')
    .in('product_id', productIds)
    .order('name', { ascending: true })
    .limit(40)

  if (error) return { rows: [], error: error.message }

  const prodMap = new Map((products ?? []).map((p) => [p.id, p.name]))
  return {
    rows: (vars ?? []).map((v) => ({
      variationId: v.id,
      productName: prodMap.get(v.product_id) ?? '—',
      variationName: v.name,
      sku: v.sku,
      stockQuantity: Number(v.stock_quantity),
    })),
    error: null,
  }
}
