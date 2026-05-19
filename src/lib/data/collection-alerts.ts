import { supabaseServer } from '@/lib/supabase/server'

const UNPAID: readonly string[] = ['issued', 'partial', 'overdue']

export type SupplierCollectionAlerts = {
  overdueCount: number
  dueSoonCount: number
}

/**
 * Unpaid invoices by due_date for supplier collection follow-up (dashboard / invoices).
 */
export async function getSupplierCollectionAlerts(): Promise<SupplierCollectionAlerts | { error: string }> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  if (!supplier) return { error: 'Not a supplier' }

  const { data: rows, error } = await supabase
    .from('invoices')
    .select('due_date, status')
    .eq('supplier_id', supplier.id)
    .in('status', UNPAID)

  if (error) return { error: error.message }

  const now = Date.now()
  const sevenDays = now + 7 * 24 * 60 * 60 * 1000
  let overdueCount = 0
  let dueSoonCount = 0

  for (const r of rows ?? []) {
    if (!r.due_date) continue
    const due = new Date(r.due_date as string).getTime()
    if (Number.isNaN(due)) continue
    if (due < now) overdueCount += 1
    else if (due <= sevenDays) dueSoonCount += 1
  }

  return {
    overdueCount,
    dueSoonCount,
  }
}
