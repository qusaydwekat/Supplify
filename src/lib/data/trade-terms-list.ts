import { supabaseServer } from '@/lib/supabase/server'
import { sumLedgerBalance, sumOverdueOpenBalance, sumUninvoicedOpenOrders } from '@/lib/data/credit-exposure'

export type TradeTermsPartnerRow = {
  retailer_id: string
  business_name: string
  ledger_balance: number
  open_uninvoiced: number
  overdue_balance: number
  credit_limit: number | null
  payment_terms_days: number
  grace_days: number
  blocked: boolean
  credit_enforcement_mode: 'block' | 'warn'
}

export async function getSupplierTradeTermsPartners(): Promise<
  { partners: TradeTermsPartnerRow[]; currencyCode: string } | { error: string }
> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id, currency_code')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!supplier) return { error: 'Not a supplier' }
  const currencyCode = String((supplier as { currency_code?: string }).currency_code ?? 'USD')

  const { data: orderRows } = await supabase.from('orders').select('retailer_id').eq('supplier_id', supplier.id)
  const { data: ledgerRows } = await supabase.from('ledger_entries').select('retailer_id').eq('supplier_id', supplier.id)

  const ids = new Set<string>()
  for (const r of orderRows ?? []) ids.add(r.retailer_id as string)
  for (const r of ledgerRows ?? []) ids.add(r.retailer_id as string)

  const retailerIds = [...ids]
  if (!retailerIds.length) return { partners: [], currencyCode }

  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('user_id, business_name, name')
    .in('user_id', retailerIds)

  if (pErr) return { error: pErr.message }

  const profMap = new Map((profiles ?? []).map((p) => [p.user_id as string, p]))

  const { data: termRows } = await supabase
    .from('retailer_supplier_terms')
    .select('retailer_id, credit_limit, payment_terms_days, grace_days, blocked, credit_enforcement_mode')
    .eq('supplier_id', supplier.id)
    .in('retailer_id', retailerIds)

  const termMap = new Map(
    (termRows ?? []).map((t) => [
      t.retailer_id as string,
      {
        credit_limit: t.credit_limit === null || t.credit_limit === undefined ? null : Number(t.credit_limit),
        payment_terms_days: Number(t.payment_terms_days),
        grace_days: Number(t.grace_days),
        blocked: Boolean(t.blocked),
        credit_enforcement_mode:
          (t as { credit_enforcement_mode?: string }).credit_enforcement_mode === 'warn' ? 'warn' : 'block',
      },
    ]),
  )

  const out: TradeTermsPartnerRow[] = []
  for (const rid of retailerIds) {
    const p = profMap.get(rid)
    const terms = termMap.get(rid)
    const ledger_balance = await sumLedgerBalance(supabase, supplier.id, rid)
    const open_uninvoiced = await sumUninvoicedOpenOrders(supabase, supplier.id, rid)
    const overdue_balance = await sumOverdueOpenBalance(supabase, supplier.id, rid)
    out.push({
      retailer_id: rid,
      business_name: p?.business_name || p?.name || 'Retailer',
      ledger_balance,
      open_uninvoiced,
      overdue_balance,
      credit_limit: terms?.credit_limit ?? null,
      payment_terms_days: terms?.payment_terms_days ?? 30,
      grace_days: terms?.grace_days ?? 0,
      blocked: terms?.blocked ?? false,
      credit_enforcement_mode: terms?.credit_enforcement_mode === 'warn' ? 'warn' : 'block',
    })
  }

  out.sort((a, b) => a.business_name.localeCompare(b.business_name))
  return { partners: out, currencyCode }
}
