import { supabaseServer } from '@/lib/supabase/server'

export type SupplierBankAccountPublic = {
  id: string
  bank_name: string
  branch: string | null
  account_holder: string
  iban: string | null
  account_number: string | null
  swift: string | null
  is_default: boolean
}

export async function listSupplierBankAccounts(
  supplierId: string,
): Promise<SupplierBankAccountPublic[]> {
  const supabase = supabaseServer()
  const { data, error } = await supabase
    .from('supplier_bank_accounts')
    .select('id, bank_name, branch, account_holder, iban, account_number, swift, is_default, is_active')
    .eq('supplier_id', supplierId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('bank_name')

  if (error) return []
  return (data ?? []).map((r) => ({
    id: r.id as string,
    bank_name: String(r.bank_name),
    branch: (r.branch as string | null) ?? null,
    account_holder: String(r.account_holder),
    iban: (r.iban as string | null) ?? null,
    account_number: (r.account_number as string | null) ?? null,
    swift: (r.swift as string | null) ?? null,
    is_default: !!r.is_default,
  }))
}
