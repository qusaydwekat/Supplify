'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { insertDomainAuditEvent } from '@/lib/data/domain-audit'
import { installmentScheduleSchema } from '@/lib/validations/installments'

function roundMoney2(n: number) {
  return Math.round(n * 100) / 100
}

export type SaveInstallmentScheduleResult =
  | { ok: true }
  | {
      ok: false
      error: string
      /** next-intl key under `InvoiceInstallments` namespace (e.g. `errors.installmentsLockedAfterPayment`). */
      errorKey?: string
      errorParams?: Record<string, string | number>
    }

export async function saveInvoiceInstallmentSchedule(input: unknown): Promise<SaveInstallmentScheduleResult> {
  const parsed = installmentScheduleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.message, errorKey: 'errors.invalidInput' }

  const { invoiceId, rows } = parsed.data

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized', errorKey: 'errors.unauthorized' }

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  if (!supplier) return { ok: false, error: 'Only suppliers can edit installment schedules', errorKey: 'errors.supplierOnly' }

  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .select('id, supplier_id, total, invoice_number')
    .eq('id', invoiceId)
    .maybeSingle()

  if (invErr || !invoice)
    return { ok: false, error: invErr?.message ?? 'Invoice not found', errorKey: 'errors.invoiceNotFound' }
  if (invoice.supplier_id !== supplier.id) return { ok: false, error: 'Forbidden', errorKey: 'errors.forbidden' }

  const { data: payments } = await supabase.from('payments').select('amount').eq('invoice_id', invoiceId)
  const paidTotal = roundMoney2((payments ?? []).reduce((s, p) => s + Number(p.amount), 0))
  if (paidTotal > 0.001) {
    return {
      ok: false,
      error: 'Installment schedule can only be changed before any payment is recorded.',
      errorKey: 'errors.installmentsLockedAfterPayment',
    }
  }

  const sorted = [...rows].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const sumDue = roundMoney2(sorted.reduce((s, r) => s + r.amountDue, 0))
  const invTotal = roundMoney2(Number(invoice.total))
  if (Math.abs(sumDue - invTotal) > 0.02) {
    return {
      ok: false,
      error: `Installment amounts must sum to the invoice total (${invTotal.toFixed(2)}); currently ${sumDue.toFixed(2)}.`,
      errorKey: 'errors.sumMismatch',
      errorParams: { expected: invTotal.toFixed(2), actual: sumDue.toFixed(2) },
    }
  }

  const { error: delErr } = await supabase.from('invoice_installments').delete().eq('invoice_id', invoiceId)
  if (delErr) return { ok: false, error: delErr.message, errorKey: 'errors.saveFailed' }

  const inserts = sorted.map((r, i) => ({
    invoice_id: invoiceId,
    seq: i + 1,
    due_date: `${r.dueDate.trim()}T12:00:00.000Z`,
    amount_due: roundMoney2(r.amountDue),
  }))

  const { error: insErr } = await supabase.from('invoice_installments').insert(inserts)
  if (insErr) return { ok: false, error: insErr.message, errorKey: 'errors.saveFailed' }

  await insertDomainAuditEvent(supabase, {
    actorId: user.id,
    entityType: 'invoice',
    entityId: invoiceId,
    action: 'installment_schedule_saved',
    payload: {
      invoice_number: invoice.invoice_number,
      installment_count: inserts.length,
    },
  })

  revalidatePath('/supplier/invoices')
  revalidatePath(`/supplier/invoices/${invoiceId}`)

  return { ok: true }
}
