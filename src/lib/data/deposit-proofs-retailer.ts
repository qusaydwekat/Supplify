import { supabaseServer } from '@/lib/supabase/server'

export type DepositProofStatus = 'pending' | 'confirmed' | 'rejected'

export type RetailerDepositProofRow = {
  id: string
  invoice_id: string
  amount: number
  payment_currency: string
  bank_name: string | null
  branch: string | null
  reference_note: string | null
  deposit_date: string | null
  status: DepositProofStatus
  reject_reason: string | null
  created_at: string
}

export async function listDepositProofsForInvoice(
  invoiceId: string,
): Promise<RetailerDepositProofRow[] | { error: string }> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: inv } = await supabase.from('invoices').select('id').eq('id', invoiceId).eq('retailer_id', user.id).maybeSingle()
  if (!inv) return { error: 'Forbidden' }

  const { data, error } = await supabase
    .from('payment_deposit_proofs')
    .select(
      'id, invoice_id, amount, payment_currency, bank_name, branch, reference_note, deposit_date, status, reject_reason, created_at',
    )
    .eq('invoice_id', invoiceId)
    .eq('retailer_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    invoice_id: r.invoice_id as string,
    amount: Number(r.amount),
    payment_currency: String(r.payment_currency),
    bank_name: (r.bank_name as string | null) ?? null,
    branch: (r.branch as string | null) ?? null,
    reference_note: (r.reference_note as string | null) ?? null,
    deposit_date: (r.deposit_date as string | null) ?? null,
    status: r.status as DepositProofStatus,
    reject_reason: (r.reject_reason as string | null) ?? null,
    created_at: r.created_at as string,
  }))
}
