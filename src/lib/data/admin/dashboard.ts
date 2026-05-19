import 'server-only'

import { supabaseServer } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import type { AdminOverviewStats } from '@/lib/data/admin/overview'
import { getAdminOverviewStats } from '@/lib/data/admin/overview'
import type { AdminAuditRow } from '@/lib/data/admin/audit-log'
import { orderRowsNewestFirst } from '@/lib/data/order-sort'

export type AdminOrderPipeline = {
  pending: number
  accepted: number
  modified: number
  rejected: number
  preparing: number
  shipped: number
  delivered: number
  cancelled: number
}

export type AdminInvoicePipeline = {
  issued: number
  paid: number
  partial: number
  overdue: number
}

export type AdminRecentOrder = {
  id: string
  status: string
  total_price: number
  created_at: string
}

export type AdminDashboardSnapshot = {
  stats: AdminOverviewStats
  adminCount: number
  orders: AdminOrderPipeline
  invoices: AdminInvoicePipeline
  recentOrders: AdminRecentOrder[]
  recentAudit: AdminAuditRow[]
}

const ORDER_STATUSES = [
  'pending',
  'accepted',
  'modified',
  'rejected',
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
] as const

const INVOICE_STATUSES = ['issued', 'paid', 'partial', 'overdue'] as const

export async function getAdminDashboardSnapshot(): Promise<AdminDashboardSnapshot> {
  await requireAdmin()
  const db = supabaseServer()

  const [
    stats,
    adminRes,
    orderCountRows,
    invCountRows,
    recentOrd,
    recentAuditRes,
  ] = await Promise.all([
    getAdminOverviewStats(),
    db.from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
    Promise.all(
      ORDER_STATUSES.map((s) =>
        db.from('orders').select('id', { count: 'exact', head: true }).eq('status', s),
      ),
    ),
    Promise.all(
      INVOICE_STATUSES.map((s) =>
        db.from('invoices').select('id', { count: 'exact', head: true }).eq('status', s),
      ),
    ),
    orderRowsNewestFirst(db.from('orders').select('id, status, total_price, created_at')).limit(8),
    db
      .from('audit_log')
      .select('id, event_type, order_id, actor_id, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const orders: AdminOrderPipeline = {
    pending: orderCountRows[0].count ?? 0,
    accepted: orderCountRows[1].count ?? 0,
    modified: orderCountRows[2].count ?? 0,
    rejected: orderCountRows[3].count ?? 0,
    preparing: orderCountRows[4].count ?? 0,
    shipped: orderCountRows[5].count ?? 0,
    delivered: orderCountRows[6].count ?? 0,
    cancelled: orderCountRows[7].count ?? 0,
  }

  const invoices: AdminInvoicePipeline = {
    issued: invCountRows[0].count ?? 0,
    paid: invCountRows[1].count ?? 0,
    partial: invCountRows[2].count ?? 0,
    overdue: invCountRows[3].count ?? 0,
  }

  return {
    stats,
    adminCount: adminRes.count ?? 0,
    orders,
    invoices,
    recentOrders: (recentOrd.data ?? []) as AdminRecentOrder[],
    recentAudit: (recentAuditRes.data ?? []) as AdminAuditRow[],
  }
}
