import type { PalestineBankRow, PalestineBranchRow } from '@/lib/data/palestine-banks'

/** Stored on payments.cheque_bank_name / cheque_branch for audit and PDFs. */
export function formatChequeSnapshotFromRows(
  bank: Pick<PalestineBankRow, 'name_en'>,
  branch: Pick<PalestineBranchRow, 'branch_number' | 'name_en' | 'city' | 'phone'>,
): { cheque_bank_name: string; cheque_branch: string } {
  const cityPart = branch.city?.trim()
  const base = `#${branch.branch_number.trim()} ${branch.name_en.trim()}${cityPart ? ` — ${cityPart}` : ''}`
  const phone = branch.phone?.trim()
  return {
    cheque_bank_name: bank.name_en.trim(),
    cheque_branch: phone ? `${base} · ${phone}` : base,
  }
}
