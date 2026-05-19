import { getTranslations } from 'next-intl/server'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Compact PMA-style daily FX panel — shows the most relevant local pairs based on
 * the configured default app currency and the currencies actively used by suppliers
 * (ILS, JOD, USD, EUR). Updated whenever the daily FX sync job runs.
 */
export async function FxRatesWidget() {
  const t = await getTranslations('FxRatesWidget')
  const supabase = supabaseServer()

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

  const updatedLatest = rows
    .map((r) => r.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1)

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">{t('title')}</h2>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t('empty')}</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{t('title')}</h2>
        <span className="text-[11px] text-muted-foreground">
          {t('base', { code: defaultCcy })}
        </span>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        {rows.map((r) => (
          <li
            key={r.code}
            className="flex items-baseline justify-between rounded-md border border-border bg-muted/30 px-2.5 py-1.5"
          >
            <span className="font-medium text-foreground">
              {r.code}/{defaultCcy}
            </span>
            <span className="font-mono tabular-nums text-foreground">
              {r.mult.toFixed(4)}
            </span>
          </li>
        ))}
      </ul>
      {updatedLatest ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          {t('updated', { when: new Date(updatedLatest).toLocaleString() })}
        </p>
      ) : null}
    </div>
  )
}
