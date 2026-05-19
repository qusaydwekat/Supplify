import type { PaymentRow } from '@/lib/invoices-types'

type RefParts = Pick<
  PaymentRow,
  'method' | 'reference_note' | 'cheque_number' | 'cheque_bank_name' | 'cheque_branch' | 'cheque_date'
>

/** Primary reference line + optional extra note (e.g. cheque meta + free-text note). */
export function formatPaymentReferenceParts(
  p: RefParts,
  formatChequeDate: (isoDate: string) => string,
  chequeMetaLine: (v: { number: string; bank: string; branch: string; date: string }) => string,
): { primary: string; note?: string } {
  if (p.method !== 'cheque') {
    return { primary: p.reference_note?.trim() || '—' }
  }

  const hasStructured =
    (p.cheque_number?.trim() ?? '') ||
    (p.cheque_bank_name?.trim() ?? '') ||
    (p.cheque_branch?.trim() ?? '') ||
    (p.cheque_date?.trim() ?? '')

  if (!hasStructured) {
    return { primary: p.reference_note?.trim() || '—' }
  }

  const primary = chequeMetaLine({
    number: p.cheque_number?.trim() || '—',
    bank: p.cheque_bank_name?.trim() || '—',
    branch: p.cheque_branch?.trim() || '—',
    date: p.cheque_date ? formatChequeDate(p.cheque_date) : '—',
  })

  const note = p.reference_note?.trim() || undefined
  return note ? { primary, note } : { primary }
}
