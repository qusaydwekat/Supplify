'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { expenseCreateSchema } from '@/lib/validations/expenses'
import { insertDomainAuditEvent } from '@/lib/data/domain-audit'

export async function createExpense(input: unknown) {
  const parsed = expenseCreateSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.message }

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: supplier } = await supabase.from('suppliers').select('id, currency_code').eq('user_id', user.id).maybeSingle()
  if (!supplier) return { error: 'Only suppliers can record expenses' }

  const ccy = parsed.data.currency_code ?? String((supplier as { currency_code?: string }).currency_code ?? 'USD')
  const expenseDate = parsed.data.expense_date?.trim()
    ? parsed.data.expense_date
    : new Date().toISOString().slice(0, 10)

  const { data: row, error } = await supabase
    .from('expenses')
    .insert({
      supplier_id: supplier.id,
      category: parsed.data.category.trim(),
      amount: parsed.data.amount,
      currency_code: ccy,
      description: parsed.data.description?.trim() || null,
      expense_date: expenseDate,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await insertDomainAuditEvent(supabase, {
    actorId: user.id,
    entityType: 'expense',
    entityId: row.id,
    action: 'create',
    payload: { amount: parsed.data.amount, category: parsed.data.category },
  })

  revalidatePath('/supplier/finance')
  revalidatePath('/supplier/reports/profit')
  return { error: null }
}
