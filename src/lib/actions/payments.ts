'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  amountInDefaultCurrency,
  convertBetween,
  loadCurrencyConversionState,
  roundMoney2,
} from '@/lib/currency'
import { insertDomainAuditEvent } from '@/lib/data/domain-audit'
import { deletePaymentSchema, recordPaymentSchema, updatePaymentSchema } from '@/lib/validations/payment'
import { writeAuditLog } from '@/lib/data/audit-log'
import { formatChequeSnapshotFromRows } from '@/lib/cheque-bank-snapshot'
import { fifoInstallmentSlices } from '@/lib/payments/fifo-installment-allocation'

type InstallmentStub = { id: string; seq: number; amount_due: number }

export type RecordPaymentResult = { paymentId: string | null; error: string | null }

export async function recordPayment(input: unknown): Promise<RecordPaymentResult> {
  const parsed = recordPaymentSchema.safeParse(input)
  if (!parsed.success) return { paymentId: null, error: parsed.error.message }

  const {
    invoiceId,
    amount,
    paymentCurrency,
    method,
    referenceNote,
    chequeNumber,
    chequeBankId,
    chequeBranchId,
    chequeDate,
    withholdingAmount,
    withholdingReference,
  } = parsed.data
  const paymentAmount = roundMoney2(amount)
  const withholding = roundMoney2(withholdingAmount ?? 0)

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { paymentId: null, error: 'Unauthorized' }

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  if (!supplier) return { paymentId: null, error: 'Only suppliers can record payments' }

  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .select('id, supplier_id, retailer_id, total, status, invoice_number, currency_code, order_id')
    .eq('id', invoiceId)
    .maybeSingle()

  if (invErr || !invoice) return { paymentId: null, error: invErr?.message ?? 'Invoice not found' }
  if (invoice.supplier_id !== supplier.id) return { paymentId: null, error: 'Forbidden' }
  if (invoice.status === 'paid') return { paymentId: null, error: 'Invoice is already paid' }

  const conv = await loadCurrencyConversionState(supabase)
  if ('error' in conv) return { paymentId: null, error: conv.error }
  if (conv.toDefault.get(paymentCurrency) == null) {
    return { paymentId: null, error: `No exchange rate for payment currency ${paymentCurrency}` }
  }

  const invoiceCurrency = String(invoice.currency_code ?? 'USD').toUpperCase()
  let amountAppliedToInvoice: number
  try {
    amountAppliedToInvoice = convertBetween(paymentAmount, paymentCurrency, invoiceCurrency, conv)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Conversion failed'
    return { paymentId: null, error: msg }
  }

  const inDefault = amountInDefaultCurrency(paymentAmount, paymentCurrency, conv)

  const { data: payments } = await supabase.from('payments').select('amount').eq('invoice_id', invoiceId)
  const paidSoFar = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const total = Number(invoice.total)
  const remaining = Math.round((total - paidSoFar) * 100) / 100

  if (amountAppliedToInvoice > remaining + 0.001) {
    return {
      paymentId: null,
      error: `Amount exceeds balance due (${remaining.toFixed(2)} ${invoiceCurrency} remaining; applied ${amountAppliedToInvoice.toFixed(2)} ${invoiceCurrency})`,
    }
  }

  const { data: instList } = await supabase
    .from('invoice_installments')
    .select('id, seq, amount_due')
    .eq('invoice_id', invoiceId)
    .order('seq')

  const installments = (instList ?? []) as InstallmentStub[]
  if (installments.length) {
    const instIds = installments.map((i) => i.id)
    const { data: priorAllocs } = await supabase
      .from('payment_installment_allocations')
      .select('installment_id, amount')
      .in('installment_id', instIds)

    const paidMap = new Map<string, number>()
    for (const a of priorAllocs ?? []) {
      const iid = a.installment_id as string
      paidMap.set(iid, roundMoney2((paidMap.get(iid) ?? 0) + Number(a.amount)))
    }

    const simPaid = new Map(paidMap)
    const sim = fifoInstallmentSlices(installments, simPaid, amountAppliedToInvoice)
    if (sim.leftover > 0.02) {
      return {
        paymentId: null,
        error:
          'This payment cannot be matched to the installment schedule (remaining per installment does not cover the payment). Review installments or amounts.',
      }
    }
  }

  const isCheque = method === 'cheque'
  const refTrimmed = referenceNote?.trim() ? referenceNote.trim() : null
  const chequeNumberTrim = isCheque ? (chequeNumber ?? '').trim() : ''
  const chequeDateStr = isCheque ? (chequeDate ?? '').trim() : ''

  let chequeBankTrim: string | null = null
  let chequeBranchTrim: string | null = null
  let chequeBankBranchId: string | null = null

  if (isCheque) {
    const bid = (chequeBankId ?? '').trim()
    const brid = (chequeBranchId ?? '').trim()
    const { data: brRow, error: brErr } = await supabase
      .from('palestine_bank_branches')
      .select('id, bank_id, branch_number, name_en, city, phone')
      .eq('id', brid)
      .maybeSingle()

    if (brErr || !brRow) {
      return { paymentId: null, error: 'Cheque branch not found. Refresh and pick bank and branch again.' }
    }
    if ((brRow as { bank_id: string }).bank_id !== bid) {
      return { paymentId: null, error: 'Branch does not match selected bank.' }
    }

    const { data: bankRow, error: bankErr } = await supabase
      .from('palestine_banks')
      .select('name_en')
      .eq('id', bid)
      .maybeSingle()

    if (bankErr || !bankRow) {
      return { paymentId: null, error: 'Bank not found.' }
    }

    const snap = formatChequeSnapshotFromRows(
      { name_en: (bankRow as { name_en: string }).name_en },
      brRow as {
        branch_number: string
        name_en: string
        city: string | null
        phone: string | null
      },
    )
    chequeBankTrim = snap.cheque_bank_name
    chequeBranchTrim = snap.cheque_branch
    chequeBankBranchId = brid
  }

  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .insert({
      invoice_id: invoiceId,
      amount: amountAppliedToInvoice,
      payment_currency: paymentCurrency,
      payment_amount: paymentAmount,
      amount_in_default_currency: inDefault,
      method,
      reference_note: refTrimmed,
      cheque_number: isCheque ? chequeNumberTrim : null,
      cheque_bank_name: isCheque ? chequeBankTrim : null,
      cheque_branch: isCheque ? chequeBranchTrim : null,
      cheque_date: isCheque && chequeDateStr ? chequeDateStr : null,
      cheque_bank_branch_id: chequeBankBranchId,
      cheque_status: isCheque ? 'pending_due' : null,
      withholding_amount: withholding,
      withholding_reference: withholding > 0 ? (withholdingReference?.trim() || null) : null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (payErr || !payment) return { paymentId: null, error: payErr?.message ?? 'Failed to record payment' }

  if (installments.length) {
    const instIds = installments.map((i) => i.id)
    const { data: priorAllocs } = await supabase
      .from('payment_installment_allocations')
      .select('installment_id, amount')
      .in('installment_id', instIds)

    const paidMap = new Map<string, number>()
    for (const a of priorAllocs ?? []) {
      const iid = a.installment_id as string
      paidMap.set(iid, roundMoney2((paidMap.get(iid) ?? 0) + Number(a.amount)))
    }

    const alloc = fifoInstallmentSlices(installments, paidMap, amountAppliedToInvoice)
    const rows = alloc.slices.map((s) => ({
      payment_id: payment.id,
      installment_id: s.installment_id,
      amount: s.amount,
    }))
    if (rows.length) {
      const { error: allocErr } = await supabase.from('payment_installment_allocations').insert(rows)
      if (allocErr) return { paymentId: null, error: allocErr.message }
    }
  }

  await insertDomainAuditEvent(supabase, {
    actorId: user.id,
    entityType: 'payment',
    entityId: payment.id,
    action: 'payment_recorded',
    payload: {
      invoice_id: invoiceId,
      invoice_number: invoice.invoice_number,
      amount_applied_invoice_currency: amountAppliedToInvoice,
      invoice_currency: invoiceCurrency,
      payment_amount: paymentAmount,
      payment_currency: paymentCurrency,
      method,
    },
  })

  if (invoice.order_id) {
    await writeAuditLog({
      actorId: user.id,
      eventType: 'payment_recorded',
      orderId: invoice.order_id as string,
      metadata: {
        invoice_id: invoiceId,
        payment_id: payment.id,
        invoice_number: invoice.invoice_number,
        amount_applied: amountAppliedToInvoice,
        invoice_currency: invoiceCurrency,
        payment_amount: paymentAmount,
        payment_currency: paymentCurrency,
        method,
      },
    })
  }

  if (invoice.retailer_id) {
    try {
      const admin = supabaseAdmin()
      await admin.from('notifications').insert({
        user_id: invoice.retailer_id,
        type: 'payment_recorded',
        title: 'Payment recorded',
        message: invoice.invoice_number
          ? `A payment was recorded for ${invoice.invoice_number}.`
          : 'A payment was recorded on your invoice.',
        title_key: 'paymentRecorded.title',
        message_key: 'paymentRecorded.message',
        params: { invoiceNumber: invoice.invoice_number ?? null },
        reference_id: payment.id,
        reference_type: 'payment',
      })
    } catch {
      // best-effort
    }
  }

  revalidatePath('/supplier/invoices')
  revalidatePath(`/supplier/invoices/${invoiceId}`)
  revalidatePath('/retailer/invoices')
  revalidatePath(`/retailer/invoices/${invoiceId}`)
  revalidatePath('/supplier/ledger')
  revalidatePath('/retailer/ledger')
  if (invoice.order_id) {
    revalidatePath(`/supplier/orders/${invoice.order_id}`)
    revalidatePath(`/retailer/orders/${invoice.order_id}`)
  }

  return { paymentId: payment.id, error: null }
}

export type UpdatePaymentResult = { error: string | null }

export async function updatePayment(input: unknown): Promise<UpdatePaymentResult> {
  const parsed = updatePaymentSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.message }

  const {
    paymentId,
    amount,
    paymentCurrency,
    method,
    referenceNote,
    chequeNumber,
    chequeBankId,
    chequeBranchId,
    chequeDate,
    withholdingAmount,
    withholdingReference,
  } = parsed.data
  const paymentAmount = roundMoney2(amount)
  const withholding = roundMoney2(withholdingAmount ?? 0)

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  if (!supplier) return { error: 'Only suppliers can edit payments' }

  const { data: existing, error: payFetchErr } = await supabase
    .from('payments')
    .select(
      'id, invoice_id, amount, payment_currency, payment_amount, method',
    )
    .eq('id', paymentId)
    .maybeSingle()

  if (payFetchErr || !existing) return { error: payFetchErr?.message ?? 'Payment not found' }

  const invoiceId = existing.invoice_id as string

  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .select('id, supplier_id, retailer_id, total, status, invoice_number, currency_code, order_id')
    .eq('id', invoiceId)
    .maybeSingle()

  if (invErr || !invoice) return { error: invErr?.message ?? 'Invoice not found' }
  if (invoice.supplier_id !== supplier.id) return { error: 'Forbidden' }

  const conv = await loadCurrencyConversionState(supabase)
  if ('error' in conv) return { error: conv.error }
  if (conv.toDefault.get(paymentCurrency) == null) {
    return { error: `No exchange rate for payment currency ${paymentCurrency}` }
  }

  const invoiceCurrency = String(invoice.currency_code ?? 'USD').toUpperCase()
  let amountAppliedToInvoice: number
  try {
    amountAppliedToInvoice = convertBetween(paymentAmount, paymentCurrency, invoiceCurrency, conv)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Conversion failed'
    return { error: msg }
  }

  const inDefault = amountInDefaultCurrency(paymentAmount, paymentCurrency, conv)

  const { data: payments } = await supabase.from('payments').select('id, amount').eq('invoice_id', invoiceId)
  const oldApplied = roundMoney2(Number((existing as { amount: number }).amount))
  const paidOther = (payments ?? []).filter((p) => p.id !== paymentId).reduce((s, p) => s + Number(p.amount), 0)
  const total = Number(invoice.total)
  const remainingRoom = Math.round((total - paidOther) * 100) / 100

  if (amountAppliedToInvoice > remainingRoom + 0.001) {
    return {
      error: `Amount exceeds balance due (${remainingRoom.toFixed(2)} ${invoiceCurrency} available for this payment; applied ${amountAppliedToInvoice.toFixed(2)} ${invoiceCurrency})`,
    }
  }

  const { data: instList } = await supabase
    .from('invoice_installments')
    .select('id, seq, amount_due')
    .eq('invoice_id', invoiceId)
    .order('seq')

  const installments = (instList ?? []) as InstallmentStub[]
  if (installments.length) {
    const instIds = installments.map((i) => i.id)
    const { data: allocRows } = await supabase
      .from('payment_installment_allocations')
      .select('payment_id, installment_id, amount')
      .in('installment_id', instIds)

    const paidMap = new Map<string, number>()
    for (const a of allocRows ?? []) {
      if ((a as { payment_id: string }).payment_id === paymentId) continue
      const iid = a.installment_id as string
      paidMap.set(iid, roundMoney2((paidMap.get(iid) ?? 0) + Number(a.amount)))
    }

    const simPaid = new Map(paidMap)
    const sim = fifoInstallmentSlices(installments, simPaid, amountAppliedToInvoice)
    if (sim.leftover > 0.02) {
      return {
        error:
          'This payment cannot be matched to the installment schedule (remaining per installment does not cover the payment). Review installments or amounts.',
      }
    }
  }

  const isCheque = method === 'cheque'
  const refTrimmed = referenceNote?.trim() ? referenceNote.trim() : null
  const chequeNumberTrim = isCheque ? (chequeNumber ?? '').trim() : ''
  const chequeDateStr = isCheque ? (chequeDate ?? '').trim() : ''

  let chequeBankTrim: string | null = null
  let chequeBranchTrim: string | null = null
  let chequeBankBranchId: string | null = null

  if (isCheque) {
    const bid = (chequeBankId ?? '').trim()
    const brid = (chequeBranchId ?? '').trim()
    const { data: brRow, error: brErr } = await supabase
      .from('palestine_bank_branches')
      .select('id, bank_id, branch_number, name_en, city, phone')
      .eq('id', brid)
      .maybeSingle()

    if (brErr || !brRow) {
      return { error: 'Cheque branch not found. Refresh and pick bank and branch again.' }
    }
    if ((brRow as { bank_id: string }).bank_id !== bid) {
      return { error: 'Branch does not match selected bank.' }
    }

    const { data: bankRow, error: bankErr } = await supabase
      .from('palestine_banks')
      .select('name_en')
      .eq('id', bid)
      .maybeSingle()

    if (bankErr || !bankRow) {
      return { error: 'Bank not found.' }
    }

    const snap = formatChequeSnapshotFromRows(
      { name_en: (bankRow as { name_en: string }).name_en },
      brRow as {
        branch_number: string
        name_en: string
        city: string | null
        phone: string | null
      },
    )
    chequeBankTrim = snap.cheque_bank_name
    chequeBranchTrim = snap.cheque_branch
    chequeBankBranchId = brid
  }

  const { error: delAllocErr } = await supabase.from('payment_installment_allocations').delete().eq('payment_id', paymentId)
  if (delAllocErr) return { error: delAllocErr.message }

  const { error: updErr } = await supabase
    .from('payments')
    .update({
      amount: amountAppliedToInvoice,
      payment_currency: paymentCurrency,
      payment_amount: paymentAmount,
      amount_in_default_currency: inDefault,
      method,
      reference_note: refTrimmed,
      cheque_number: isCheque ? chequeNumberTrim : null,
      cheque_bank_name: isCheque ? chequeBankTrim : null,
      cheque_branch: isCheque ? chequeBranchTrim : null,
      cheque_date: isCheque && chequeDateStr ? chequeDateStr : null,
      cheque_bank_branch_id: chequeBankBranchId,
      withholding_amount: withholding,
      withholding_reference: withholding > 0 ? (withholdingReference?.trim() || null) : null,
    })
    .eq('id', paymentId)

  if (updErr) return { error: updErr.message }

  if (installments.length) {
    const instIds = installments.map((i) => i.id)
    const { data: priorAllocs } = await supabase
      .from('payment_installment_allocations')
      .select('installment_id, amount')
      .in('installment_id', instIds)

    const paidMap = new Map<string, number>()
    for (const a of priorAllocs ?? []) {
      const iid = a.installment_id as string
      paidMap.set(iid, roundMoney2((paidMap.get(iid) ?? 0) + Number(a.amount)))
    }

    const alloc = fifoInstallmentSlices(installments, paidMap, amountAppliedToInvoice)
    const rows = alloc.slices.map((s) => ({
      payment_id: paymentId,
      installment_id: s.installment_id,
      amount: s.amount,
    }))
    if (rows.length) {
      const { error: allocErr } = await supabase.from('payment_installment_allocations').insert(rows)
      if (allocErr) return { error: allocErr.message }
    }
  }

  await insertDomainAuditEvent(supabase, {
    actorId: user.id,
    entityType: 'payment',
    entityId: paymentId,
    action: 'payment_updated',
    payload: {
      invoice_id: invoiceId,
      invoice_number: invoice.invoice_number,
      amount_applied_invoice_currency: amountAppliedToInvoice,
      invoice_currency: invoiceCurrency,
      payment_amount: paymentAmount,
      payment_currency: paymentCurrency,
      method,
      previous_amount_applied: oldApplied,
    },
  })

  if (invoice.order_id) {
    await writeAuditLog({
      actorId: user.id,
      eventType: 'payment_updated',
      orderId: invoice.order_id as string,
      metadata: {
        invoice_id: invoiceId,
        payment_id: paymentId,
        invoice_number: invoice.invoice_number,
        amount_applied: amountAppliedToInvoice,
        invoice_currency: invoiceCurrency,
        payment_amount: paymentAmount,
        payment_currency: paymentCurrency,
        method,
      },
    })
  }

  revalidatePath('/supplier/invoices')
  revalidatePath(`/supplier/invoices/${invoiceId}`)
  revalidatePath('/supplier/payments')
  revalidatePath('/retailer/invoices')
  revalidatePath(`/retailer/invoices/${invoiceId}`)
  revalidatePath('/supplier/ledger')
  revalidatePath('/retailer/ledger')
  if (invoice.order_id) {
    revalidatePath(`/supplier/orders/${invoice.order_id}`)
    revalidatePath(`/retailer/orders/${invoice.order_id}`)
  }

  return { error: null }
}

export async function deletePayment(input: unknown): Promise<{ error: string | null }> {
  const parsed = deletePaymentSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.message }

  const { paymentId } = parsed.data

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  if (!supplier) return { error: 'Only suppliers can delete payments' }

  const { data: existing, error: payErr } = await supabase
    .from('payments')
    .select('id, invoice_id, amount, payment_currency, payment_amount, method')
    .eq('id', paymentId)
    .maybeSingle()

  if (payErr || !existing) return { error: payErr?.message ?? 'Payment not found' }

  const invoiceId = existing.invoice_id as string

  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .select('id, supplier_id, retailer_id, invoice_number, currency_code, order_id')
    .eq('id', invoiceId)
    .maybeSingle()

  if (invErr || !invoice) return { error: invErr?.message ?? 'Invoice not found' }
  if (invoice.supplier_id !== supplier.id) return { error: 'Forbidden' }

  const { error: delErr } = await supabase.from('payments').delete().eq('id', paymentId)
  if (delErr) return { error: delErr.message }

  const amountApplied = roundMoney2(Number((existing as { amount: number }).amount))
  const payAmt = roundMoney2(Number((existing as { payment_amount: number }).payment_amount))
  const payCcy = String((existing as { payment_currency: string }).payment_currency).toUpperCase()
  const invCcy = String(invoice.currency_code ?? 'USD').toUpperCase()

  await insertDomainAuditEvent(supabase, {
    actorId: user.id,
    entityType: 'payment',
    entityId: paymentId,
    action: 'payment_deleted',
    payload: {
      invoice_id: invoiceId,
      invoice_number: invoice.invoice_number,
      amount_applied_invoice_currency: amountApplied,
      invoice_currency: invCcy,
      payment_amount: payAmt,
      payment_currency: payCcy,
      method: String((existing as { method: string }).method),
    },
  })

  if (invoice.order_id) {
    await writeAuditLog({
      actorId: user.id,
      eventType: 'payment_deleted',
      orderId: invoice.order_id as string,
      metadata: {
        invoice_id: invoiceId,
        payment_id: paymentId,
        invoice_number: invoice.invoice_number,
        amount_applied: amountApplied,
        invoice_currency: invCcy,
        payment_amount: payAmt,
        payment_currency: payCcy,
        method: String((existing as { method: string }).method),
      },
    })
  }

  revalidatePath('/supplier/invoices')
  revalidatePath(`/supplier/invoices/${invoiceId}`)
  revalidatePath('/supplier/payments')
  revalidatePath('/retailer/invoices')
  revalidatePath(`/retailer/invoices/${invoiceId}`)
  revalidatePath('/supplier/ledger')
  revalidatePath('/retailer/ledger')
  if (invoice.order_id) {
    revalidatePath(`/supplier/orders/${invoice.order_id}`)
    revalidatePath(`/retailer/orders/${invoice.order_id}`)
  }

  return { error: null }
}
