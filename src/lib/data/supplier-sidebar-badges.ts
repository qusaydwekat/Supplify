import 'server-only'

import { requireRequestUserId } from '@/lib/auth/request-session'
import type { SupplierNavBadges } from '@/lib/supplier-nav-badges'
import { supabaseServer } from '@/lib/supabase/server'

export type { SupplierNavBadges }

export async function getSupplierNavBadges(): Promise<SupplierNavBadges | null> {
  const userId = await requireRequestUserId()
  const supabase = supabaseServer()

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', userId).maybeSingle()
  if (!supplier) return null

  const sid = supplier.id

  const [{ count: pendingOrders }, { count: pendingDeposits }] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', sid)
      .eq('status', 'pending'),
    supabase
      .from('payment_deposit_proofs')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', sid)
      .eq('status', 'pending'),
  ])

  return {
    supplierId: sid,
    pendingOrders: pendingOrders ?? 0,
    pendingDeposits: pendingDeposits ?? 0,
  }
}
