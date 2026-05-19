'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import {
  deletePalestineBankSchema,
  deletePalestineBranchSchema,
  upsertPalestineBankSchema,
  upsertPalestineBranchSchema,
} from '@/lib/validations/palestine-banks'

async function getSupplierOrAdmin(supabase: ReturnType<typeof supabaseServer>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null as null, isAdmin: false, supplierOk: false }

  const { data: ur } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const isAdmin = ur?.role === 'admin'
  if (isAdmin) return { user, isAdmin: true, supplierOk: true }

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  return { user, isAdmin: false, supplierOk: Boolean(supplier) }
}

function revalidateBankViews() {
  revalidatePath('/supplier/invoices')
  revalidatePath('/admin/banks')
}

export async function upsertPalestineBank(input: unknown) {
  const parsed = upsertPalestineBankSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = supabaseServer()
  const gate = await getSupplierOrAdmin(supabase)
  if (!gate.user) return { error: { root: ['Unauthorized'] } }
  if (!gate.supplierOk) return { error: { root: ['Only suppliers can manage banks'] } }

  const { id, nameEn, nameAr } = parsed.data
  const nar = nameAr?.trim() ? nameAr.trim() : null

  if (id) {
    const { data: row } = await supabase.from('palestine_banks').select('id').eq('id', id).maybeSingle()
    if (!row) return { error: { root: ['Bank not found'] } }

    const { error } = await supabase
      .from('palestine_banks')
      .update({
        name_en: nameEn.trim(),
        name_ar: nar,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) return { error: { root: [error.message] } }
  } else {
    const { error } = await supabase.from('palestine_banks').insert({
      name_en: nameEn.trim(),
      name_ar: nar,
      sort_order: 900,
      is_seed: false,
    })

    if (error) return { error: { root: [error.message] } }
  }

  revalidateBankViews()
  return { error: null }
}

export async function deletePalestineBank(input: unknown) {
  const parsed = deletePalestineBankSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.message }

  const supabase = supabaseServer()
  const gate = await getSupplierOrAdmin(supabase)
  if (!gate.user) return { error: 'Unauthorized' }
  if (!gate.supplierOk) return { error: 'Only suppliers can manage banks' }

  const { data: row } = await supabase.from('palestine_banks').select('is_seed').eq('id', parsed.data.id).maybeSingle()
  if (!row) return { error: 'Bank not found' }
  if ((row as { is_seed?: boolean }).is_seed && !gate.isAdmin) return { error: 'Cannot delete directory banks' }

  const { error } = await supabase.from('palestine_banks').delete().eq('id', parsed.data.id)
  if (error) return { error: error.message }

  revalidateBankViews()
  return { error: null }
}

export async function upsertPalestineBranch(input: unknown) {
  const parsed = upsertPalestineBranchSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = supabaseServer()
  const gate = await getSupplierOrAdmin(supabase)
  if (!gate.user) return { error: { root: ['Unauthorized'] } }
  if (!gate.supplierOk) return { error: { root: ['Only suppliers can manage branches'] } }

  const { id, bankId, branchNumber, nameEn, nameAr, city, phone } = parsed.data
  const nar = nameAr?.trim() ? nameAr.trim() : null
  const cityVal = city?.trim() ? city.trim() : null
  const phoneVal = phone?.trim() ? phone.trim() : null

  if (id) {
    const { data: row } = await supabase.from('palestine_bank_branches').select('id').eq('id', id).maybeSingle()
    if (!row) return { error: { root: ['Branch not found'] } }

    const { error } = await supabase
      .from('palestine_bank_branches')
      .update({
        bank_id: bankId,
        branch_number: branchNumber.trim(),
        name_en: nameEn.trim(),
        name_ar: nar,
        city: cityVal,
        phone: phoneVal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) return { error: { root: [error.message] } }
  } else {
    const { error } = await supabase.from('palestine_bank_branches').insert({
      bank_id: bankId,
      branch_number: branchNumber.trim(),
      name_en: nameEn.trim(),
      name_ar: nar,
      city: cityVal,
      phone: phoneVal,
      sort_order: 900,
      is_seed: false,
    })

    if (error) return { error: { root: [error.message] } }
  }

  revalidateBankViews()
  return { error: null }
}

export async function deletePalestineBranch(input: unknown) {
  const parsed = deletePalestineBranchSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.message }

  const supabase = supabaseServer()
  const gate = await getSupplierOrAdmin(supabase)
  if (!gate.user) return { error: 'Unauthorized' }
  if (!gate.supplierOk) return { error: 'Only suppliers can manage branches' }

  const { data: row } = await supabase.from('palestine_bank_branches').select('is_seed').eq('id', parsed.data.id).maybeSingle()
  if (!row) return { error: 'Branch not found' }
  if ((row as { is_seed?: boolean }).is_seed && !gate.isAdmin) return { error: 'Cannot delete directory branches' }

  const { error } = await supabase.from('palestine_bank_branches').delete().eq('id', parsed.data.id)
  if (error) return { error: error.message }

  revalidateBankViews()
  return { error: null }
}
