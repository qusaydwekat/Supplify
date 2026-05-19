import { supabaseServer } from '@/lib/supabase/server'

export type AuditEventType =
  | 'order_lines_modified'
  | 'payment_recorded'
  | 'payment_updated'
  | 'payment_deleted'
  | 'order_accepted'
  | 'order_rejected'
  | 'order_cancelled_by_retailer'
  | 'order_modification_confirmed'
  | 'order_status_preparing'
  | 'order_status_delivered'
  | 'order_shipped'
  | 'delivery_person_reassigned'
  | 'invoice_created'
  | 'cheque_deposited'
  | 'cheque_cleared'
  | 'cheque_bounced'
  | 'cheque_replaced'
  | 'deposit_proof_submitted'
  | 'deposit_proof_confirmed'
  | 'deposit_proof_rejected'
  | 'cod_collected'

export type AuditLogRow = {
  id: string
  actor_id: string
  event_type: string
  metadata: Record<string, unknown>
  created_at: string
  actor_label: string
}

export async function writeAuditLog(entry: {
  actorId: string
  eventType: AuditEventType
  orderId: string
  metadata: Record<string, unknown>
}): Promise<{ error: string | null }> {
  const supabase = supabaseServer()
  const { data: o, error: oErr } = await supabase
    .from('orders')
    .select('supplier_id, retailer_id')
    .eq('id', entry.orderId)
    .maybeSingle()

  if (oErr || !o) return { error: oErr?.message ?? 'Order not found for audit' }

  const { error } = await supabase.from('audit_log').insert({
    actor_id: entry.actorId,
    event_type: entry.eventType,
    order_id: entry.orderId,
    supplier_id: o.supplier_id,
    retailer_id: o.retailer_id,
    metadata: entry.metadata,
  })

  if (error) return { error: error.message }
  return { error: null }
}

export async function getOrderAuditLog(orderId: string): Promise<AuditLogRow[] | { error: string }> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: order } = await supabase.from('orders').select('id, retailer_id, supplier_id').eq('id', orderId).maybeSingle()
  if (!order) return { error: 'Order not found' }

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  const isSupplier = supplier && order.supplier_id === supplier.id
  const isRetailer = order.retailer_id === user.id
  if (!isSupplier && !isRetailer) return { error: 'Forbidden' }

  const { data: rows, error } = await supabase
    .from('audit_log')
    .select('id, actor_id, event_type, metadata, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  const actorIds = [...new Set((rows ?? []).map((r) => r.actor_id as string))]
  const { data: profs } = await supabase.from('profiles').select('user_id, name, business_name').in('user_id', actorIds)
  const labelMap = new Map(
    (profs ?? []).map((p) => [
      p.user_id as string,
      (p.business_name || p.name || 'User').trim() || 'User',
    ]),
  )

  return (rows ?? []).map((r) => ({
    id: r.id as string,
    actor_id: r.actor_id as string,
    event_type: r.event_type as string,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    created_at: r.created_at as string,
    actor_label: labelMap.get(r.actor_id as string) ?? 'User',
  }))
}
