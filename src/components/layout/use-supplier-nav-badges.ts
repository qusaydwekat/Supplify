'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { SupplierNavBadges } from '@/lib/supplier-nav-badges'

async function fetchCounts(supplierId: string): Promise<Pick<SupplierNavBadges, 'pendingOrders' | 'pendingDeposits'>> {
  const supabase = supabaseBrowser()
  const [{ count: pendingOrders }, { count: pendingDeposits }] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', supplierId)
      .eq('status', 'pending'),
    supabase
      .from('payment_deposit_proofs')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', supplierId)
      .eq('status', 'pending'),
  ])
  return {
    pendingOrders: pendingOrders ?? 0,
    pendingDeposits: pendingDeposits ?? 0,
  }
}

export function useSupplierNavBadges(initial: SupplierNavBadges | null) {
  const [badges, setBadges] = useState(initial)

  const refresh = useCallback(async () => {
    if (!initial?.supplierId) return
    const next = await fetchCounts(initial.supplierId)
    setBadges((prev) => (prev ? { ...prev, ...next } : null))
  }, [initial?.supplierId])

  useEffect(() => {
    setBadges(initial)
  }, [initial])

  useEffect(() => {
    if (!initial?.supplierId) return
    const supabase = supabaseBrowser()
    const sid = initial.supplierId

    const channel = supabase
      .channel(`supplier-nav-badges:${sid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `supplier_id=eq.${sid}` },
        () => void refresh(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_deposit_proofs',
          filter: `supplier_id=eq.${sid}`,
        },
        () => void refresh(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [initial?.supplierId, refresh])

  return badges
}
