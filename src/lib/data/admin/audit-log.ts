import 'server-only'

import { supabaseServer } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'

export type AdminAuditRow = {
  id: string
  event_type: string
  order_id: string
  actor_id: string
  metadata: Record<string, unknown>
  created_at: string
}

export type AdminAuditLogParams = {
  limit?: number
  /** Case-insensitive partial match on event_type */
  q?: string | null
}

export async function listAuditLogForAdmin(params: AdminAuditLogParams = {}): Promise<AdminAuditRow[]> {
  await requireAdmin()
  const db = supabaseServer()
  const limit = Math.min(Math.max(params.limit ?? 150, 1), 500)

  let query = db
    .from('audit_log')
    .select('id, event_type, order_id, actor_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  const q = params.q?.trim()
  if (q) {
    query = query.ilike('event_type', `%${q}%`)
  }

  const { data, error } = await query

  if (error || !data) return []
  return data as AdminAuditRow[]
}
