'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/data/audit-log'
import { recordPayment } from '@/lib/actions/payments'
import { parseSupportedSupplierCurrency } from '@/lib/currency'

const submitSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  paymentCurrency: z
    .string()
    .length(3)
    .transform((s) => s.toUpperCase())
    .refine((s) => parseSupportedSupplierCurrency(s) !== null, 'Unsupported currency'),
  bankName: z.string().optional().or(z.literal('')),
  branch: z.string().optional().or(z.literal('')),
  referenceNote: z.string().optional().or(z.literal('')),
  depositDate: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((s) => !s || !Number.isNaN(Date.parse(s)), 'Invalid date'),
  attachmentPath: z.string().optional().or(z.literal('')),
  attachmentName: z.string().optional().or(z.literal('')),
})

function clean(v: string | undefined | null) {
  const t = (v ?? '').trim()
  return t.length ? t : null
}

export async function submitDepositProof(input: unknown) {
  const parsed = submitSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.message, id: null }

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', id: null }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, supplier_id, retailer_id, invoice_number, order_id')
    .eq('id', parsed.data.invoiceId)
    .maybeSingle()
  if (!invoice || invoice.retailer_id !== user.id) {
    return { error: 'Forbidden', id: null }
  }

  const { data: inserted, error: insErr } = await supabase
    .from('payment_deposit_proofs')
    .insert({
      invoice_id: invoice.id,
      supplier_id: invoice.supplier_id,
      retailer_id: user.id,
      amount: parsed.data.amount,
      payment_currency: parsed.data.paymentCurrency,
      bank_name: clean(parsed.data.bankName),
      branch: clean(parsed.data.branch),
      reference_note: clean(parsed.data.referenceNote),
      deposit_date: clean(parsed.data.depositDate),
      attachment_path: clean(parsed.data.attachmentPath),
      attachment_name: clean(parsed.data.attachmentName),
    })
    .select('id')
    .single()
  if (insErr || !inserted) return { error: insErr?.message ?? 'Insert failed', id: null }

  if (invoice.order_id) {
    await writeAuditLog({
      actorId: user.id,
      eventType: 'deposit_proof_submitted',
      orderId: invoice.order_id as string,
      metadata: {
        invoice_id: invoice.id,
        deposit_proof_id: inserted.id,
        amount: parsed.data.amount,
        currency: parsed.data.paymentCurrency,
        invoice_number: invoice.invoice_number,
      },
    })
  }

  // Notify the supplier user.
  try {
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('user_id')
      .eq('id', invoice.supplier_id)
      .maybeSingle()
    if (supplier?.user_id) {
      const admin = supabaseAdmin()
      await admin.from('notifications').insert({
        user_id: supplier.user_id,
        type: 'deposit_proof_submitted',
        title: 'New deposit proof',
        message: `A bank deposit proof was submitted for ${invoice.invoice_number ?? 'an invoice'}.`,
        title_key: 'depositProofSubmitted.title',
        message_key: 'depositProofSubmitted.message',
        params: { invoiceNumber: invoice.invoice_number ?? null },
        reference_id: inserted.id,
        reference_type: 'deposit_proof',
      })
    }
  } catch {
    // best-effort
  }

  revalidatePath(`/retailer/invoices/${invoice.id}`)
  revalidatePath('/supplier/payments/deposits')
  return { error: null, id: inserted.id }
}

const confirmSchema = z.object({
  depositProofId: z.string().uuid(),
})

export async function confirmDepositProof(input: unknown) {
  const parsed = confirmSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.message }

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!supplier) return { error: 'Forbidden' }

  const { data: dp, error: dpErr } = await supabase
    .from('payment_deposit_proofs')
    .select('id, invoice_id, supplier_id, amount, payment_currency, reference_note, status, deposit_date')
    .eq('id', parsed.data.depositProofId)
    .maybeSingle()
  if (dpErr || !dp) return { error: dpErr?.message ?? 'Not found' }
  if (dp.supplier_id !== supplier.id) return { error: 'Forbidden' }
  if (dp.status !== 'pending') return { error: 'Already reviewed' }

  // Convert to a real bank payment.
  const pay = await recordPayment({
    invoiceId: dp.invoice_id as string,
    amount: Number(dp.amount),
    paymentCurrency: String(dp.payment_currency).toUpperCase(),
    method: 'bank',
    referenceNote: dp.reference_note
      ? `Bank deposit (retailer-submitted) — ${dp.reference_note}`
      : 'Bank deposit (retailer-submitted)',
  })
  if (pay.error) return { error: pay.error }

  const { error: updErr } = await supabase
    .from('payment_deposit_proofs')
    .update({
      status: 'confirmed',
      payment_id: pay.paymentId,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq('id', dp.id)
  if (updErr) return { error: updErr.message }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('order_id, invoice_number')
    .eq('id', dp.invoice_id as string)
    .maybeSingle()

  if (invoice?.order_id) {
    await writeAuditLog({
      actorId: user.id,
      eventType: 'deposit_proof_confirmed',
      orderId: invoice.order_id as string,
      metadata: {
        deposit_proof_id: dp.id,
        payment_id: pay.paymentId,
        amount: Number(dp.amount),
        invoice_number: invoice.invoice_number,
      },
    })
  }

  revalidatePath('/supplier/payments/deposits')
  revalidatePath(`/supplier/invoices/${dp.invoice_id}`)
  revalidatePath(`/retailer/invoices/${dp.invoice_id}`)
  return { error: null }
}

const rejectSchema = z.object({
  depositProofId: z.string().uuid(),
  reason: z.string().min(3).max(500),
})

export async function rejectDepositProof(input: unknown) {
  const parsed = rejectSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.message }

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!supplier) return { error: 'Forbidden' }

  const { data: dp } = await supabase
    .from('payment_deposit_proofs')
    .select('id, supplier_id, invoice_id, status')
    .eq('id', parsed.data.depositProofId)
    .maybeSingle()
  if (!dp || dp.supplier_id !== supplier.id) return { error: 'Forbidden' }
  if (dp.status !== 'pending') return { error: 'Already reviewed' }

  const { error: updErr } = await supabase
    .from('payment_deposit_proofs')
    .update({
      status: 'rejected',
      reject_reason: parsed.data.reason.trim(),
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq('id', dp.id)
  if (updErr) return { error: updErr.message }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('order_id, invoice_number')
    .eq('id', dp.invoice_id as string)
    .maybeSingle()

  if (invoice?.order_id) {
    await writeAuditLog({
      actorId: user.id,
      eventType: 'deposit_proof_rejected',
      orderId: invoice.order_id as string,
      metadata: {
        deposit_proof_id: dp.id,
        reason: parsed.data.reason.trim(),
        invoice_number: invoice.invoice_number,
      },
    })
  }

  revalidatePath('/supplier/payments/deposits')
  revalidatePath(`/supplier/invoices/${dp.invoice_id}`)
  revalidatePath(`/retailer/invoices/${dp.invoice_id}`)
  return { error: null }
}
