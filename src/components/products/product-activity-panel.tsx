import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import type { InventoryInsightRow } from '@/lib/data/inventory-insights'
import { cn } from '@/lib/utils'

type Props = {
  rows: InventoryInsightRow[]
  currencyCode: string
  productId: string
}

export async function ProductActivityPanel({ rows, currencyCode, productId }: Props) {
  const t = await getTranslations('ProductHub')

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('activityEmpty')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('activityHint')}</p>
        <Link
          href="/supplier/inventory-insights"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t('openInventoryInsights')}
        </Link>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="min-w-[720px] w-full divide-y divide-border text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="px-4 py-3 text-start font-semibold">{t('colSku')}</th>
              <th className="px-4 py-3 text-end font-semibold">{t('colStock')}</th>
              <th className="px-4 py-3 text-end font-semibold">{t('colSold30d')}</th>
              <th className="px-4 py-3 text-end font-semibold">{t('colVelocity')}</th>
              <th className="px-4 py-3 text-end font-semibold">{t('colCover')}</th>
              <th className="px-4 py-3 text-end font-semibold">{t('colValue')}</th>
              <th className="px-4 py-3 text-center font-semibold">{t('colFlags')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {rows.map((r) => (
              <tr key={r.variationId} className={cn(r.isLowStock && 'bg-amber-50/80')}>
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{r.variationLabel ?? '—'}</div>
                  <div className="text-xs text-muted-foreground">{r.productName}</div>
                </td>
                <td className="px-4 py-3 text-end tabular-nums">{r.stock}</td>
                <td className="px-4 py-3 text-end tabular-nums">{r.unitsSold30d}</td>
                <td className="px-4 py-3 text-end tabular-nums">{r.dailyVelocity.toFixed(2)}/d</td>
                <td className="px-4 py-3 text-end tabular-nums">
                  {r.coverDays != null ? `${r.coverDays}d` : '—'}
                </td>
                <td className="px-4 py-3 text-end tabular-nums">
                  {currencyCode} {r.valuationLine.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-wrap justify-center gap-1">
                    {r.isLowStock ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">{t('flagLow')}</span>
                    ) : null}
                    {r.isReorderCandidate ? (
                      <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs text-sky-900">{t('flagReorder')}</span>
                    ) : null}
                    {!r.isActiveSku ? (
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-700">{t('flagInactive')}</span>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
