import type { SupabaseClient } from '@supabase/supabase-js'

export type PartnerStatementRpcRow = {
  line_ts: string
  entry_kind: string
  reference_id: string
  description: string
  debit: number
  credit: number
  running_balance: number
}

export async function fetchPartnerStatementRows(
  supabase: SupabaseClient,
  args: {
    supplierId: string
    retailerId: string
    from?: string | null
    to?: string | null
  },
): Promise<{ rows: PartnerStatementRpcRow[] } | { error: string }> {
  const { data, error } = await supabase.rpc('supplier_partner_statement', {
    p_supplier_id: args.supplierId,
    p_retailer_id: args.retailerId,
    p_from: args.from?.trim()
      ? new Date(args.from.trim()).toISOString()
      : new Date(0).toISOString(),
    p_to: args.to?.trim()
      ? new Date(args.to.trim()).toISOString()
      : new Date('2100-01-01T00:00:00Z').toISOString(),
  })

  if (error) return { error: error.message }
  const rows = (data ?? []) as PartnerStatementRpcRow[]
  return { rows }
}
