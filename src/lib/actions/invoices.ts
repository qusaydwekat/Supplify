'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { insertDomainAuditEvent } from '@/lib/data/domain-audit'
import { writeAuditLog } from '@/lib/data/audit-log'
import { createInvoiceFromOrderSchema } from '@/lib/validations/invoice'

export type CreateInvoiceResult = { invoiceId: string | null; error: string | null }

export async function createInvoiceFromOrder(input: unknown): Promise<CreateInvoiceResult> {
  const parsed = createInvoiceFromOrderSchema.safeParse(input)
  if (!parsed.success) return { invoiceId: null, error: parsed.error.message }

  const { orderId, notes, dueInDays } = parsed.data

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { invoiceId: null, error: 'Unauthorized' }

  const { data: invoiceId, error } = await supabase.rpc('create_invoice_from_order', {
    p_order_id: orderId,
    p_supplier_user_id: user.id,
    p_notes: notes?.trim() ?? '',
    p_due_days: dueInDays,
  })

  if (error) {
    return { invoiceId: null, error: error.message }
  }

  const id = invoiceId as string | null
  if (!id) return { invoiceId: null, error: 'No invoice id returned' }

  const { data: inv } = await supabase.from('invoices').select('invoice_number, retailer_id').eq('id', id).maybeSingle()

  await insertDomainAuditEvent(supabase, {
    actorId: user.id,
    entityType: 'invoice',
    entityId: id,
    action: 'created_from_order',
    payload: {
      order_id: orderId,
      invoice_number: inv?.invoice_number ?? null,
      due_in_days: dueInDays,
    },
  })

  await writeAuditLog({
    actorId: user.id,
    eventType: 'invoice_created',
    orderId,
    metadata: {
      invoice_id: id,
      invoice_number: inv?.invoice_number ?? null,
      due_in_days: dueInDays,
    },
  })

  if (inv?.retailer_id) {
    try {
      const admin = supabaseAdmin()
      await admin.from('notifications').insert({
        user_id: inv.retailer_id,
        type: 'invoice_issued',
        title: 'New invoice',
        message: inv.invoice_number
          ? `Invoice ${inv.invoice_number} is ready to view.`
          : 'A new invoice is ready to view.',
        title_key: 'invoiceIssued.title',
        message_key: 'invoiceIssued.message',
        params: { invoiceNumber: inv.invoice_number ?? null },
        reference_id: id,
        reference_type: 'invoice',
      })
    } catch {
      // best-effort
    }
  }

  revalidatePath('/supplier/invoices')
  revalidatePath(`/supplier/invoices/${id}`)
  revalidatePath('/retailer/invoices')
  revalidatePath('/supplier/orders')
  revalidatePath(`/supplier/orders/${orderId}`)
  revalidatePath('/supplier/ledger')
  revalidatePath('/retailer/ledger')

  return { invoiceId: id, error: null }
}
