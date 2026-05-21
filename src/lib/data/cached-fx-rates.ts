import { unstable_cache } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type FxRatesSnapshot = {
  defaultCcy: string
  rows: { code: string; mult: number; updatedAt: string }[]
}

async function loadFxRatesSnapshot(): Promise<FxRatesSnapshot> {
  const supabase = supabaseAdmin()
  const [{ data: settings }, { data: rates }] = await Promise.all([
    supabase.from('app_settings').select('default_currency').eq('id', 1).maybeSingle(),
    supabase
      .from('currency_rates')
      .select('currency_code, to_default_multiplier, updated_at')
      .order('currency_code'),
  ])

  const defaultCcy = String(settings?.default_currency ?? 'USD').toUpperCase()
  const rows = (rates ?? [])
    .map((r) => ({
      code: String(r.currency_code).toUpperCase(),
      mult: Number(r.to_default_multiplier),
      updatedAt: r.updated_at as string,
    }))
    .filter((r) => r.code !== defaultCcy)

  return { defaultCcy, rows }
}

/** FX rates change at most daily — cache to avoid duplicate DB hits on dashboards. */
export const getCachedFxRatesSnapshot = unstable_cache(loadFxRatesSnapshot, ['fx-rates-snapshot'], {
  revalidate: 3600,
})
