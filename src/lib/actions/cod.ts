'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/data/audit-log'
import { createInvoiceFromOrder } from '@/lib/actions/invoices'
import { recordPayment } from '@/lib/actions/payments'

/**
 * Cash-on-delivery flow:
 *  - The supplier confirms cash was collected during delivery.
 *  - We create the invoice for the order (if not already issued).
 *  - We record a full cash payment in the supplier's currency.
 *
 * Both downstream actions perform their own permission checks and audit logging.
 */
export async function markCodCollected(orderId: string) {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', invoiceId: null }

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id, user_id, currency_code')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!supplier) return { error: 'Only suppliers can collect COD', invoiceId: null }

  const { data: order } = await supabase
    .from('orders')
    .select('id, supplier_id, status, total_price, is_cod')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) return { error: 'Order not found', invoiceId: null }
  if (order.supplier_id !== supplier.id) return { error: 'Forbidden', invoiceId: null }
  if (!order.is_cod) return { error: 'Order is not a COD order', invoiceId: null }
  if (order.status !== 'delivered') {
    return { error: 'Mark the order delivered before recording cash collection', invoiceId: null }
  }

  // Reuse existing invoice if it has already been created for the order.
  let { data: existingInvoice } = await supabase
    .from('invoices')
    .select('id, total, currency_code, status')
    .eq('order_id', orderId)
    .maybeSingle()

  if (existingInvoice?.status === 'paid') {
    return { error: null, invoiceId: existingInvoice.id, alreadyCollected: true as const }
  }

  if (!existingInvoice) {
    const created = await createInvoiceFromOrder({ orderId, dueInDays: 1 })
    if (created.error || !created.invoiceId) {
      return { error: created.error ?? 'Could not issue invoice', invoiceId: null }
    }
    const refetch = await supabase
      .from('invoices')
      .select('id, total, currency_code, status')
      .eq('id', created.invoiceId)
      .maybeSingle()
    existingInvoice = refetch.data ?? null
    if (!existingInvoice) return { error: 'Invoice not found after creation', invoiceId: null }
  }

  if (existingInvoice.status !== 'paid') {
    const invoiceCurrency = String(existingInvoice.currency_code ?? 'USD').toUpperCase()
    const { data: priorPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('invoice_id', existingInvoice.id)
    const paidSoFar = (priorPayments ?? []).reduce((s, r) => s + Number(r.amount), 0)
    const remaining = Math.round((Number(existingInvoice.total) - paidSoFar) * 100) / 100
    if (remaining > 0.01) {
      const pay = await recordPayment({
        invoiceId: existingInvoice.id,
        amount: remaining,
        paymentCurrency: invoiceCurrency,
        method: 'cash',
        referenceNote: 'COD collected on delivery',
      })
      if (pay.error) return { error: pay.error, invoiceId: existingInvoice.id }
    }
  }

  await writeAuditLog({
    actorId: user.id,
    eventType: 'cod_collected',
    orderId,
    metadata: { invoice_id: existingInvoice.id, total: Number(existingInvoice.total) },
  })

  revalidatePath(`/supplier/orders/${orderId}`)
  revalidatePath(`/retailer/orders/${orderId}`)
  revalidatePath(`/supplier/invoices/${existingInvoice.id}`)
  revalidatePath(`/retailer/invoices/${existingInvoice.id}`)

  return { error: null, invoiceId: existingInvoice.id, alreadyCollected: false as const }
}
