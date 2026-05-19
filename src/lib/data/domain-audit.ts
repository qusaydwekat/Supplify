import type { SupabaseClient } from '@supabase/supabase-js'

export async function insertDomainAuditEvent(
  supabase: SupabaseClient,
  args: {
    actorId: string
    entityType: string
    entityId: string
    action: string
    payload?: Record<string, unknown>
  },
): Promise<void> {
  await supabase.from('domain_audit_events').insert({
    actor_id: args.actorId,
    entity_type: args.entityType,
    entity_id: args.entityId,
    action: args.action,
    payload: args.payload ?? {},
  })
}
