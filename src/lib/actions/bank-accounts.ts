'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'

const bankAccountSchema = z.object({
  bank_name: z.string().min(1, 'Bank name is required'),
  branch: z.string().optional().or(z.literal('')),
  account_holder: z.string().min(1, 'Account holder is required'),
  iban: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || v.replace(/\s+/g, '').length >= 8, {
      message: 'IBAN looks too short',
    }),
  account_number: z.string().optional().or(z.literal('')),
  swift: z.string().optional().or(z.literal('')),
  is_default: z.boolean().optional().default(false),
  notes: z.string().optional().or(z.literal('')),
})

export type BankAccountInput = z.infer<typeof bankAccountSchema>

async function resolveSupplier() {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, supplier: null, error: 'Unauthorized' as const }

  const { data: supplier, error } = await supabase
    .from('suppliers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error || !supplier) return { supabase, supplier: null, error: 'Supplier not found' as const }
  return { supabase, supplier, error: null as null }
}

function clean(value: string | undefined | null) {
  const t = (value ?? '').trim()
  return t.length ? t : null
}

export async function addSupplierBankAccount(input: unknown) {
  const parsed = bankAccountSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.message }
  const { supabase, supplier, error } = await resolveSupplier()
  if (error || !supplier) return { error: error ?? 'Supplier not found' }

  if (parsed.data.is_default) {
    await supabase
      .from('supplier_bank_accounts')
      .update({ is_default: false })
      .eq('supplier_id', supplier.id)
      .eq('is_default', true)
  }

  const { error: insErr } = await supabase.from('supplier_bank_accounts').insert({
    supplier_id: supplier.id,
    bank_name: parsed.data.bank_name.trim(),
    branch: clean(parsed.data.branch),
    account_holder: parsed.data.account_holder.trim(),
    iban: clean(parsed.data.iban?.replace(/\s+/g, '')),
    account_number: clean(parsed.data.account_number),
    swift: clean(parsed.data.swift),
    is_default: !!parsed.data.is_default,
    notes: clean(parsed.data.notes),
  })
  if (insErr) return { error: insErr.message }

  revalidatePath('/supplier/profile')
  return { error: null }
}

export async function setDefaultSupplierBankAccount(accountId: string) {
  const { supabase, supplier, error } = await resolveSupplier()
  if (error || !supplier) return { error: error ?? 'Supplier not found' }

  await supabase
    .from('supplier_bank_accounts')
    .update({ is_default: false })
    .eq('supplier_id', supplier.id)
    .eq('is_default', true)

  const { error: upErr } = await supabase
    .from('supplier_bank_accounts')
    .update({ is_default: true })
    .eq('id', accountId)
    .eq('supplier_id', supplier.id)
  if (upErr) return { error: upErr.message }

  revalidatePath('/supplier/profile')
  return { error: null }
}

export async function toggleSupplierBankAccount(accountId: string, isActive: boolean) {
  const { supabase, supplier, error } = await resolveSupplier()
  if (error || !supplier) return { error: error ?? 'Supplier not found' }

  const { error: upErr } = await supabase
    .from('supplier_bank_accounts')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', accountId)
    .eq('supplier_id', supplier.id)
  if (upErr) return { error: upErr.message }

  revalidatePath('/supplier/profile')
  return { error: null }
}

export async function deleteSupplierBankAccount(accountId: string) {
  const { supabase, supplier, error } = await resolveSupplier()
  if (error || !supplier) return { error: error ?? 'Supplier not found' }

  const { error: delErr } = await supabase
    .from('supplier_bank_accounts')
    .delete()
    .eq('id', accountId)
    .eq('supplier_id', supplier.id)
  if (delErr) return { error: delErr.message }

  revalidatePath('/supplier/profile')
  return { error: null }
}
