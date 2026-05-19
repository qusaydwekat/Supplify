'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  adminSetDefaultCurrency,
  adminUpsertCurrencyRate,
  adminSyncMarketExchangeRates,
} from '@/lib/actions/admin/currencies'
import type { AdminCurrencyRateRow } from '@/lib/data/admin/currencies'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RefreshCw } from 'lucide-react'

type Props = {
  defaultCurrency: string
  rates: AdminCurrencyRateRow[]
  fxLastFetchedAt: string | null
  fxLastSource: string | null
}

export function AdminCurrenciesPanel({ defaultCurrency, rates, fxLastFetchedAt, fxLastSource }: Props) {
  const t = useTranslations('Admin')
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-slate-900/90 to-slate-800 p-5 text-white shadow-lg sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-lg font-semibold">{t('marketRatesTitle')}</h2>
            <p className="text-sm leading-relaxed text-white/75">{t('marketRatesIntro')}</p>
            {fxLastFetchedAt ? (
              <p className="text-xs text-white/60">
                {t('marketLastSync')}: {new Date(fxLastFetchedAt).toLocaleString()}
                {fxLastSource ? ` · ${fxLastSource}` : ''}
              </p>
            ) : (
              <p className="text-xs text-white/60">{t('marketNeverSynced')}</p>
            )}
            <p className="text-xs text-white/50">{t('marketRatesAutoSync')}</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            className="shrink-0 gap-2 bg-white text-slate-900 hover:bg-white/90"
            onClick={() =>
              start(async () => {
                const res = await adminSyncMarketExchangeRates()
                if (res.error) toast.error(res.error)
                else {
                  toast.success(t('marketSyncSuccess'))
                  if (res.detail) toast.info(res.detail)
                  router.refresh()
                }
              })
            }
          >
            <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
            {pending ? t('marketSyncing') : t('syncMarketRates')}
          </Button>
        </div>
      </div>

      <form
        className="flex max-w-xl flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-end sm:p-5"
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          const code = String(fd.get('defaultCurrency') ?? '')
            .trim()
            .toUpperCase()
          start(async () => {
            const res = await adminSetDefaultCurrency({ currencyCode: code })
            if (res.error) toast.error(res.error)
            else {
              toast.success(t('defaultCurrencySaved'))
              router.refresh()
            }
          })
        }}
      >
        <div className="flex-1">
          <label className="form-label" htmlFor="default-currency">
            {t('defaultCurrencyLabel')}
          </label>
          <Input
            id="default-currency"
            name="defaultCurrency"
            className="mt-1.5 uppercase"
            maxLength={3}
            defaultValue={defaultCurrency}
            required
          />
          <p className="mt-1.5 text-xs text-muted-foreground">{t('defaultCurrencyHint')}</p>
        </div>
        <Button type="submit" disabled={pending}>
          {t('save')}
        </Button>
      </form>

      <div>
        <h2 className="text-lg font-semibold text-foreground">{t('fxRatesTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('fxRatesHint')}</p>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('colCurrency')}</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('colMultiplier')}</th>
                <th className="hidden px-4 py-3 text-start font-medium text-muted-foreground sm:table-cell">
                  {t('colUpdated')}
                </th>
                <th className="w-[120px] px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.currency_code} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono">{r.currency_code}</td>
                  <td className="px-4 py-3">
                    <form
                      className="flex flex-wrap items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        const fd = new FormData(e.currentTarget)
                        const mult = Number(fd.get('mult'))
                        start(async () => {
                          const res = await adminUpsertCurrencyRate({
                            currencyCode: r.currency_code,
                            toDefaultMultiplier: mult,
                          })
                          if (res.error) toast.error(res.error)
                          else {
                            toast.success(t('rateSaved'))
                            router.refresh()
                          }
                        })
                      }}
                    >
                      <Input
                        name="mult"
                        type="number"
                        step="any"
                        min="0"
                        className="w-36 font-mono text-sm"
                        defaultValue={r.to_default_multiplier}
                        required
                      />
                      <Button type="submit" variant="secondary" disabled={pending} className="min-h-9 px-3 py-1.5 text-xs">
                        {t('save')}
                      </Button>
                    </form>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">
                    {new Date(r.updated_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
