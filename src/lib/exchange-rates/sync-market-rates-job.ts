import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPPORTED_SUPPLIER_CURRENCIES } from '@/lib/currency'
import { fetchMarketMultipliers } from '@/lib/exchange-rates/market-rates'

export type SyncMarketRatesJobResult =
  | {
      ok: true
      source: string
      rateDate: string | null
      /** Rates saved but app_settings FX metadata update failed */
      metaWarning?: string
    }
  | { ok: false; error: string }

/**
 * Fetches live FX and writes `currency_rates` + FX sync metadata on `app_settings`.
 * Works with any Supabase client that can write those tables (user session or service role).
 */
export async function syncMarketExchangeRatesJob(db: SupabaseClient): Promise<SyncMarketRatesJobResult> {
  const { data: settings, error: settingsErr } = await db
    .from('app_settings')
    .select('default_currency')
    .eq('id', 1)
    .maybeSingle()

  if (settingsErr) return { ok: false, error: settingsErr.message }
  const defaultCurrency = String(settings?.default_currency ?? 'USD').toUpperCase()

  if (!(SUPPORTED_SUPPLIER_CURRENCIES as readonly string[]).includes(defaultCurrency)) {
    return {
      ok: false,
      error: 'Global price currency must be one of ILS, USD, or JOD before syncing market rates.',
    }
  }

  let market: Awaited<ReturnType<typeof fetchMarketMultipliers>>
  try {
    market = await fetchMarketMultipliers(defaultCurrency)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Market fetch failed'
    return { ok: false, error: msg }
  }

  const now = new Date().toISOString()
  const rows = SUPPORTED_SUPPLIER_CURRENCIES.map((code) => ({
    currency_code: code,
    to_default_multiplier: market.multipliers[code],
    updated_at: now,
  }))

  const { error: upErr } = await db.from('currency_rates').upsert(rows, { onConflict: 'currency_code' })
  if (upErr) return { ok: false, error: upErr.message }

  const metaPayload = {
    fx_last_fetched_at: now,
    fx_last_source: `${market.source}${market.rateDate ? ` · ${market.rateDate}` : ''}`,
  }
  const { error: metaErr } = await db.from('app_settings').update(metaPayload).eq('id', 1)
  if (metaErr) {
    return {
      ok: true,
      source: market.source,
      rateDate: market.rateDate,
      metaWarning: `Rates saved but could not store sync metadata: ${metaErr.message}`,
    }
  }

  return { ok: true, source: market.source, rateDate: market.rateDate }
}
