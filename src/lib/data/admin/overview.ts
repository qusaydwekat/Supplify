import 'server-only'

import { supabaseServer } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'

export type AdminOverviewStats = {
  supplierCount: number
  retailerUserCount: number
  orderCount: number
  invoiceCount: number
  productCount: number
  bankCount: number
  branchCount: number
  defaultCurrency: string
}

export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  await requireAdmin()
  const db = supabaseServer()

  const [
    supRes,
    retRes,
    ordRes,
    invRes,
    prodRes,
    bankRes,
    brRes,
    settingsRes,
  ] = await Promise.all([
    db.from('suppliers').select('id', { count: 'exact', head: true }),
    db.from('users').select('id', { count: 'exact', head: true }).eq('role', 'retailer'),
    db.from('orders').select('id', { count: 'exact', head: true }),
    db.from('invoices').select('id', { count: 'exact', head: true }),
    db.from('products').select('id', { count: 'exact', head: true }),
    db.from('palestine_banks').select('id', { count: 'exact', head: true }),
    db.from('palestine_bank_branches').select('id', { count: 'exact', head: true }),
    db.from('app_settings').select('default_currency').eq('id', 1).maybeSingle(),
  ])

  return {
    supplierCount: supRes.count ?? 0,
    retailerUserCount: retRes.count ?? 0,
    orderCount: ordRes.count ?? 0,
    invoiceCount: invRes.count ?? 0,
    productCount: prodRes.count ?? 0,
    bankCount: bankRes.count ?? 0,
    branchCount: brRes.count ?? 0,
    defaultCurrency: String((settingsRes.data as { default_currency?: string } | null)?.default_currency ?? 'USD'),
  }
}
