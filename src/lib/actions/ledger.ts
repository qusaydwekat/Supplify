'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { insertDomainAuditEvent } from '@/lib/data/domain-audit'
import {
  deleteManualLedgerEntrySchema,
  ledgerEntryNoteSchema,
  manualLedgerEntrySchema,
  updateManualLedgerEntrySchema,
} from '@/lib/validations/ledger'

export async function addManualLedgerEntry(input: unknown) {
  const parsed = manualLedgerEntrySchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join('; ') }

  const { retailerId, type, amount, description } = parsed.data

  const supabase = supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!supplier) return { error: 'Not a supplier' }

  const signedAmount = type === 'credit_note' ? -amount : amount
  const refId = crypto.randomUUID()

  const { data: inserted, error: insertErr } = await supabase
    .from('ledger_entries')
    .insert({
      supplier_id: supplier.id,
      retailer_id: retailerId,
      type,
      amount: signedAmount,
      reference_id: refId,
      description,
    })
    .select('id')
    .single()

  if (insertErr) return { error: insertErr.message }

  await insertDomainAuditEvent(supabase, {
    actorId: user.id,
    entityType: 'ledger_entry',
    entityId: inserted.id,
    action: 'manual_insert',
    payload: {
      retailer_id: retailerId,
      type,
      amount: signedAmount,
      description,
    },
  })

  revalidatePath('/supplier/ledger')
  return { error: null }
}

export async function saveLedgerEntryNote(input: unknown) {
  const parsed = ledgerEntryNoteSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join('; ') }

  const { entryId, note } = parsed.data
  const supabase = supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (!note.trim()) {
    await supabase.from('ledger_entry_notes').delete().eq('entry_id', entryId)
    revalidatePath('/supplier/ledger')
    return { error: null }
  }

  const { data: existing } = await supabase
    .from('ledger_entry_notes')
    .select('id')
    .eq('entry_id', entryId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('ledger_entry_notes')
      .update({ note: note.trim(), created_by: user.id })
      .eq('entry_id', entryId)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('ledger_entry_notes').insert({
      entry_id: entryId,
      note: note.trim(),
      created_by: user.id,
    })
    if (error) return { error: error.message }
  }

  revalidatePath('/supplier/ledger')
  return { error: null }
}

export async function updateManualLedgerEntry(input: unknown) {
  const parsed = updateManualLedgerEntrySchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join('; ') }

  const { entryId, retailerId, amount, description } = parsed.data

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  if (!supplier) return { error: 'Not a supplier' }

  const { data: existing, error: fetchErr } = await supabase
    .from('ledger_entries')
    .select('id, supplier_id, type, amount')
    .eq('id', entryId)
    .maybeSingle()

  if (fetchErr || !existing) return { error: fetchErr?.message ?? 'Entry not found' }
  if (existing.supplier_id !== supplier.id) return { error: 'Forbidden' }

  const t = existing.type as string
  if (t !== 'credit_note' && t !== 'debit_note') {
    return { error: 'Only manual credit or debit notes can be edited' }
  }

  const signedAmount = t === 'credit_note' ? -amount : amount

  const { error: updErr } = await supabase
    .from('ledger_entries')
    .update({
      retailer_id: retailerId,
      amount: signedAmount,
      description,
    })
    .eq('id', entryId)

  if (updErr) return { error: updErr.message }

  await insertDomainAuditEvent(supabase, {
    actorId: user.id,
    entityType: 'ledger_entry',
    entityId: entryId,
    action: 'manual_update',
    payload: {
      retailer_id: retailerId,
      type: t,
      amount: signedAmount,
      description,
    },
  })

  revalidatePath('/supplier/ledger')
  return { error: null }
}

export async function deleteManualLedgerEntry(input: unknown) {
  const parsed = deleteManualLedgerEntrySchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join('; ') }

  const { entryId } = parsed.data

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  if (!supplier) return { error: 'Not a supplier' }

  const { data: existing, error: fetchErr } = await supabase
    .from('ledger_entries')
    .select('id, supplier_id, type')
    .eq('id', entryId)
    .maybeSingle()

  if (fetchErr || !existing) return { error: fetchErr?.message ?? 'Entry not found' }
  if (existing.supplier_id !== supplier.id) return { error: 'Forbidden' }

  const t = existing.type as string
  if (t !== 'credit_note' && t !== 'debit_note') {
    return { error: 'Only manual credit or debit notes can be deleted' }
  }

  const { error: delErr } = await supabase.from('ledger_entries').delete().eq('id', entryId)
  if (delErr) return { error: delErr.message }

  await insertDomainAuditEvent(supabase, {
    actorId: user.id,
    entityType: 'ledger_entry',
    entityId: entryId,
    action: 'manual_delete',
    payload: { type: t },
  })

  revalidatePath('/supplier/ledger')
  return { error: null }
}
