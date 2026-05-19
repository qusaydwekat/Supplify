'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { insertDomainAuditEvent } from '@/lib/data/domain-audit'
import { parseUpsertTradeTerms } from '@/lib/validations/trade-terms'
import { orderRowsNewestFirst } from '@/lib/data/order-sort'

export async function upsertRetailerSupplierTerms(input: unknown): Promise<{ error: string | null }> {
  const parsed = parseUpsertTradeTerms(input)
  if (!parsed.success) return { error: parsed.error }

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  if (!supplier) return { error: 'Only suppliers can update trade terms' }

  const rid = parsed.data.retailerId
  const { data: ord } = await orderRowsNewestFirst(
    supabase.from('orders').select('id').eq('supplier_id', supplier.id).eq('retailer_id', rid),
  ).limit(1)
  const { data: led } = await supabase.from('ledger_entries').select('id').eq('supplier_id', supplier.id).eq('retailer_id', rid).limit(1)
  if (!(ord?.length || led?.length)) {
    return { error: 'There is no order or ledger history with this retailer for your store.' }
  }

  const { error } = await supabase.from('retailer_supplier_terms').upsert(
    {
      supplier_id: supplier.id,
      retailer_id: rid,
      credit_limit: parsed.data.credit_limit,
      payment_terms_days: parsed.data.payment_terms_days,
      grace_days: parsed.data.grace_days,
      blocked: parsed.data.blocked,
      credit_enforcement_mode: parsed.data.credit_enforcement_mode,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'supplier_id,retailer_id' },
  )

  if (error) return { error: error.message }

  await insertDomainAuditEvent(supabase, {
    actorId: user.id,
    entityType: 'trade_terms',
    entityId: rid,
    action: 'upsert',
    payload: {
      supplier_id: supplier.id,
      credit_limit: parsed.data.credit_limit,
      payment_terms_days: parsed.data.payment_terms_days,
      grace_days: parsed.data.grace_days,
      blocked: parsed.data.blocked,
      credit_enforcement_mode: parsed.data.credit_enforcement_mode,
    },
  })

  revalidatePath('/supplier/trade-terms')
  revalidatePath('/supplier/invoices/new')
  revalidatePath(`/retailer/browse/${supplier.id}`)
  return { error: null }
}
