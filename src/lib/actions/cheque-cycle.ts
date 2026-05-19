'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/data/audit-log'

type ChequeStatus = 'pending_due' | 'deposited' | 'cleared' | 'bounced' | 'replaced'

async function loadPaymentForSupplier(paymentId: string) {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, error: 'Unauthorized' as const, payment: null, supplierId: null, orderId: null }

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!supplier) return { supabase, error: 'Forbidden' as const, payment: null, supplierId: null, orderId: null }

  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .select('id, invoice_id, method, cheque_status, cheque_number, amount')
    .eq('id', paymentId)
    .maybeSingle()
  if (payErr || !payment) return { supabase, error: 'Payment not found' as const, payment: null, supplierId: null, orderId: null }
  if (payment.method !== 'cheque') return { supabase, error: 'Not a cheque payment' as const, payment: null, supplierId: null, orderId: null }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, supplier_id, retailer_id, order_id, invoice_number')
    .eq('id', payment.invoice_id as string)
    .maybeSingle()
  if (!invoice || invoice.supplier_id !== supplier.id) {
    return { supabase, error: 'Forbidden' as const, payment: null, supplierId: null, orderId: null }
  }

  return {
    supabase,
    error: null as null,
    payment,
    supplierId: supplier.id,
    orderId: (invoice.order_id as string | null) ?? null,
    invoiceId: invoice.id as string,
    invoiceNumber: (invoice.invoice_number as string | null) ?? null,
    retailerId: (invoice.retailer_id as string | null) ?? null,
    userId: user.id,
  }
}

function revalidateInvoice(invoiceId: string, orderId: string | null) {
  revalidatePath('/supplier/invoices')
  revalidatePath(`/supplier/invoices/${invoiceId}`)
  revalidatePath('/retailer/invoices')
  revalidatePath(`/retailer/invoices/${invoiceId}`)
  if (orderId) {
    revalidatePath(`/supplier/orders/${orderId}`)
    revalidatePath(`/retailer/orders/${orderId}`)
  }
}

export async function markChequeDeposited(paymentId: string) {
  const ctx = await loadPaymentForSupplier(paymentId)
  if (ctx.error) return { error: ctx.error }
  const next: ChequeStatus = 'deposited'
  const { error } = await ctx.supabase
    .from('payments')
    .update({ cheque_status: next, cheque_bounced_at: null, cheque_cleared_at: null })
    .eq('id', paymentId)
  if (error) return { error: error.message }
  if (ctx.orderId && ctx.userId) {
    await writeAuditLog({
      actorId: ctx.userId,
      eventType: 'cheque_deposited',
      orderId: ctx.orderId,
      metadata: { payment_id: paymentId, invoice_number: ctx.invoiceNumber, cheque_number: ctx.payment?.cheque_number },
    })
  }
  revalidateInvoice(ctx.invoiceId!, ctx.orderId)
  return { error: null }
}

export async function markChequeCleared(paymentId: string) {
  const ctx = await loadPaymentForSupplier(paymentId)
  if (ctx.error) return { error: ctx.error }
  const { error } = await ctx.supabase
    .from('payments')
    .update({ cheque_status: 'cleared' as ChequeStatus, cheque_cleared_at: new Date().toISOString(), cheque_bounced_at: null })
    .eq('id', paymentId)
  if (error) return { error: error.message }
  if (ctx.orderId && ctx.userId) {
    await writeAuditLog({
      actorId: ctx.userId,
      eventType: 'cheque_cleared',
      orderId: ctx.orderId,
      metadata: { payment_id: paymentId, invoice_number: ctx.invoiceNumber, cheque_number: ctx.payment?.cheque_number },
    })
  }
  revalidateInvoice(ctx.invoiceId!, ctx.orderId)
  return { error: null }
}

export async function markChequeBounced(paymentId: string, reason: string) {
  const ctx = await loadPaymentForSupplier(paymentId)
  if (ctx.error) return { error: ctx.error }
  const trimmed = (reason ?? '').trim().slice(0, 500)
  if (!trimmed) return { error: 'A short reason is required for bounced cheques' }

  // Mark cheque bounced. The supplier should then record a replacement cheque
  // or an alternative payment; ledger/journal triggers will reconcile balance.
  const { error } = await ctx.supabase
    .from('payments')
    .update({
      cheque_status: 'bounced' as ChequeStatus,
      cheque_bounced_at: new Date().toISOString(),
      cheque_bounce_reason: trimmed,
      // Bouncing a cheque means the money never landed: zero applied amounts so
      // ledger triggers restore the receivable (payments_amount_check allows 0 only when bounced cheque).
      amount: 0,
      payment_amount: 0,
      amount_in_default_currency: 0,
    })
    .eq('id', paymentId)
  if (error) return { error: error.message }

  if (ctx.orderId && ctx.userId) {
    await writeAuditLog({
      actorId: ctx.userId,
      eventType: 'cheque_bounced',
      orderId: ctx.orderId,
      metadata: {
        payment_id: paymentId,
        invoice_number: ctx.invoiceNumber,
        cheque_number: ctx.payment?.cheque_number,
        reason: trimmed,
      },
    })
  }

  const retailerId = ctx.retailerId
  if (retailerId) {
    try {
      const admin = supabaseAdmin()
      await admin.from('notifications').insert({
        user_id: retailerId,
        type: 'cheque_bounced',
        title: 'Cheque bounced',
        message: ctx.invoiceNumber
          ? `Your cheque payment on invoice ${ctx.invoiceNumber} was marked as bounced.`
          : 'A cheque payment on your invoice was marked as bounced.',
        title_key: 'chequeBounced.title',
        message_key: 'chequeBounced.message',
        params: {
          invoiceNumber: ctx.invoiceNumber ?? null,
          chequeNumber: (ctx.payment?.cheque_number as string | null) ?? null,
        },
        reference_id: ctx.invoiceId!,
        reference_type: 'invoice',
      })
    } catch {
      // best-effort
    }
  }

  revalidateInvoice(ctx.invoiceId!, ctx.orderId)
  return { error: null }
}
