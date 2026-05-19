import { supabaseServer } from '@/lib/supabase/server'

export type PalestineBankRow = {
  id: string
  name_en: string
  name_ar: string | null
  sort_order: number
  is_seed: boolean
}

export type PalestineBranchRow = {
  id: string
  bank_id: string
  branch_number: string
  name_en: string
  name_ar: string | null
  city: string | null
  phone: string | null
  sort_order: number
  is_seed: boolean
}

export async function listPalestineBanksAndBranches(): Promise<
  | {
      banks: PalestineBankRow[]
      branches: PalestineBranchRow[]
    }
  | { error: string }
> {
  const supabase = supabaseServer()
  const { data: banks, error: bErr } = await supabase
    .from('palestine_banks')
    .select('id, name_en, name_ar, sort_order, is_seed')
    .order('sort_order', { ascending: true })

  if (bErr) return { error: bErr.message }

  const { data: branches, error: brErr } = await supabase
    .from('palestine_bank_branches')
    .select('id, bank_id, branch_number, name_en, name_ar, city, phone, sort_order, is_seed')
    .order('sort_order', { ascending: true })

  if (brErr) return { error: brErr.message }

  return {
    banks: (banks ?? []) as PalestineBankRow[],
    branches: (branches ?? []) as PalestineBranchRow[],
  }
}
