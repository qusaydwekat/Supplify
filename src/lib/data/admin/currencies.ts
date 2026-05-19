import 'server-only'

import { supabaseServer } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'

export type AdminCurrencyRateRow = {
  currency_code: string
  to_default_multiplier: number
  updated_at: string
}

export async function getAdminCurrencyState(): Promise<{
  defaultCurrency: string
  rates: AdminCurrencyRateRow[]
  fxLastFetchedAt: string | null
  fxLastSource: string | null
}> {
  await requireAdmin()
  const db = supabaseServer()

  const [{ data: settings, error: settingsErr }, { data: rates }] = await Promise.all([
    db.from('app_settings').select('default_currency, fx_last_fetched_at, fx_last_source').eq('id', 1).maybeSingle(),
    db.from('currency_rates').select('currency_code, to_default_multiplier, updated_at').order('currency_code'),
  ])

  let st = settings as {
    default_currency?: string
    fx_last_fetched_at?: string | null
    fx_last_source?: string | null
  } | null

  if (settingsErr && !st) {
    const { data: fallback } = await db.from('app_settings').select('default_currency').eq('id', 1).maybeSingle()
    st = {
      default_currency: (fallback as { default_currency?: string } | null)?.default_currency,
      fx_last_fetched_at: null,
      fx_last_source: null,
    }
  }

  return {
    defaultCurrency: String(st?.default_currency ?? 'USD'),
    rates: (rates ?? []) as AdminCurrencyRateRow[],
    fxLastFetchedAt: st?.fx_last_fetched_at ?? null,
    fxLastSource: st?.fx_last_source ?? null,
  }
}
