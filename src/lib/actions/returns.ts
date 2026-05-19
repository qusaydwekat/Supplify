'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { insertDomainAuditEvent } from '@/lib/data/domain-audit'

/** Supplier approves a return: optional restock/damage movements + invoice credit adjustment when linked. */
export async function approveProductReturn(returnId: string) {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  if (!supplier) return { error: 'Only suppliers can approve returns' }

  const { data: ret, error: rErr } = await supabase
    .from('product_returns')
    .select('id, supplier_id, retailer_id, invoice_id, status')
    .eq('id', returnId)
    .maybeSingle()

  if (rErr || !ret) return { error: rErr?.message ?? 'Return not found' }
  if (ret.supplier_id !== supplier.id) return { error: 'Forbidden' }
  if (ret.status !== 'pending' && ret.status !== 'draft') return { error: 'Return is not pending approval' }

  const { data: lines, error: lErr } = await supabase.from('product_return_items').select('*').eq('return_id', returnId)
  if (lErr || !lines?.length) return { error: lErr?.message ?? 'No line items' }

  let creditTotal = 0

  for (const line of lines) {
    const qty = Number(line.quantity)
    const vid = line.product_variation_id as string
    const cond = line.condition as string
    const unitCredit = line.unit_credit != null ? Number(line.unit_credit) : null

    if (cond === 'restockable') {
      const { error: mErr } = await supabase.from('inventory_movements').insert({
        supplier_id: supplier.id,
        product_variation_id: vid,
        type: 'return',
        quantity: qty,
        adjustment_increase: true,
        reference_type: 'customer_return',
        reference_id: returnId,
      })
      if (mErr) return { error: mErr.message }
    } else {
      const { error: dErr } = await supabase.from('inventory_movements').insert({
        supplier_id: supplier.id,
        product_variation_id: vid,
        type: 'damage',
        quantity: qty,
        adjustment_increase: true,
        reference_type: 'customer_return',
        reference_id: returnId,
        notes: 'Damaged return — not restocked',
      })
      if (dErr) return { error: dErr.message }
    }

    if (unitCredit != null && Number.isFinite(unitCredit)) {
      creditTotal += unitCredit * qty
    }
  }

  if (ret.invoice_id && creditTotal > 0) {
    const { error: adjErr } = await supabase.from('invoice_adjustments').insert({
      invoice_id: ret.invoice_id,
      supplier_id: supplier.id,
      amount: Math.round(creditTotal * 100) / 100,
      reason: 'Approved product return',
      product_return_id: returnId,
      created_by: user.id,
    })
    if (adjErr) return { error: adjErr.message }
  }

  const { error: uErr } = await supabase
    .from('product_returns')
    .update({
      status: 'approved',
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', returnId)

  if (uErr) return { error: uErr.message }

  await insertDomainAuditEvent(supabase, {
    actorId: user.id,
    entityType: 'product_return',
    entityId: returnId,
    action: 'approve',
    payload: { creditTotal },
  })

  revalidatePath('/supplier/finance')
  revalidatePath('/supplier/invoices')
  return { error: null }
}

export async function createProductReturnDraft(input: {
  retailerId: string
  orderId?: string | null
  invoiceId?: string | null
  reason?: string | null
  lines: { variationId: string; quantity: number; condition: 'restockable' | 'damaged'; unitCredit?: number | null }[]
}) {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', returnId: null }

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  if (!supplier) return { error: 'Only suppliers can open returns', returnId: null }

  if (!input.lines?.length) return { error: 'Add at least one line', returnId: null }

  const { data: ret, error: insErr } = await supabase
    .from('product_returns')
    .insert({
      supplier_id: supplier.id,
      retailer_id: input.retailerId,
      order_id: input.orderId ?? null,
      invoice_id: input.invoiceId ?? null,
      status: 'pending',
      reason: input.reason?.trim() || null,
    })
    .select('id')
    .single()

  if (insErr || !ret) return { error: insErr?.message ?? 'Failed', returnId: null }

  const rows = input.lines.map((l) => ({
    return_id: ret.id,
    product_variation_id: l.variationId,
    quantity: l.quantity,
    condition: l.condition,
    unit_credit: l.unitCredit ?? null,
  }))

  const { error: liErr } = await supabase.from('product_return_items').insert(rows)
  if (liErr) return { error: liErr.message, returnId: null }

  await insertDomainAuditEvent(supabase, {
    actorId: user.id,
    entityType: 'product_return',
    entityId: ret.id,
    action: 'create',
    payload: {},
  })

  revalidatePath('/supplier/finance')
  return { error: null, returnId: ret.id }
}
