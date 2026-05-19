import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { formatMoney } from '@/lib/format-money'
import { formatDateMedium, normalizeAppLocale } from '@/lib/format-datetime'
import { cn } from '@/lib/utils'
import type { InventoryInsightRow } from '@/lib/data/inventory-insights'

type Props = {
  rows: InventoryInsightRow[]
  currencyCode: string
}

function StatusPills({
  row,
  labels,
}: {
  row: InventoryInsightRow
  labels: { reorder: string; lowStock: string; inactive: string; noMovement: string }
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {row.isReorderCandidate ? (
        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
          {labels.reorder}
        </span>
      ) : null}
      {row.isLowStock ? (
        <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-900 dark:bg-rose-950/50 dark:text-rose-100">
          {labels.lowStock}
        </span>
      ) : null}
      {!row.isActiveSku ? (
        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {labels.inactive}
        </span>
      ) : null}
      {row.unitsSold30d <= 0 && row.stock > 0 ? (
        <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-900 dark:bg-sky-950/50 dark:text-sky-100">
          {labels.noMovement}
        </span>
      ) : null}
    </div>
  )
}

export async function InventoryInsightsTable({ rows, currencyCode }: Props) {
  const t = await getTranslations('InventoryInsightsPage')
  const locale = normalizeAppLocale(await getLocale())
  const pillLabels = {
    reorder: t('badgeReorder'),
    lowStock: t('badgeLowStock'),
    inactive: t('badgeInactive'),
    noMovement: t('badgeNoMovement'),
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:block">
        <div className="max-h-[min(70vh,640px)] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-[1] border-b border-border bg-muted/80 backdrop-blur-sm">
              <tr className="text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">{t('colProduct')}</th>
                <th className="px-4 py-3">{t('colStatus')}</th>
                <th className="px-4 py-3 text-end">{t('colStock')}</th>
                <th className="px-4 py-3 text-end">{t('colSold30')}</th>
                <th className="px-4 py-3 text-end">{t('colVelocity')}</th>
                <th className="px-4 py-3 text-end">{t('colCover')}</th>
                <th className="px-4 py-3 text-end">{t('colLineVal')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.variationId} className="transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/supplier/products/${r.productId}`}
                      className="font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
                    >
                      {r.productName}
                    </Link>
                    {r.variationLabel ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{r.variationLabel}</p>
                    ) : null}
                    {r.lastSaleAt ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {t('lastSale', { date: formatDateMedium(r.lastSaleAt, locale) })}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPills row={r} labels={pillLabels} />
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums">{r.stock}</td>
                  <td className="px-4 py-3 text-end tabular-nums">{r.unitsSold30d}</td>
                  <td className="px-4 py-3 text-end tabular-nums text-muted-foreground">
                    {r.dailyVelocity > 0 ? r.dailyVelocity.toFixed(2) : '—'}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3 text-end tabular-nums',
                      r.isReorderCandidate && 'font-semibold text-amber-800 dark:text-amber-200',
                    )}
                  >
                    {r.coverDays != null ? `${r.coverDays} ${t('days')}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-end font-medium tabular-nums">
                    {formatMoney(r.valuationLine, currencyCode)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((r) => (
          <article
            key={r.variationId}
            className="rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/supplier/products/${r.productId}`}
                  className="font-semibold text-foreground underline-offset-2 hover:text-primary hover:underline"
                >
                  {r.productName}
                </Link>
                {r.variationLabel ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">{r.variationLabel}</p>
                ) : null}
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums">
                {formatMoney(r.valuationLine, currencyCode)}
              </p>
            </div>
            <div className="mt-2">
              <StatusPills row={r} labels={pillLabels} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-muted-foreground">{t('colStock')}</dt>
                <dd className="font-medium tabular-nums">{r.stock}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('colSold30')}</dt>
                <dd className="font-medium tabular-nums">{r.unitsSold30d}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('colCover')}</dt>
                <dd className="font-medium tabular-nums">
                  {r.coverDays != null ? `${r.coverDays} ${t('days')}` : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('colVelocity')}</dt>
                <dd className="font-medium tabular-nums">
                  {r.dailyVelocity > 0 ? r.dailyVelocity.toFixed(2) : '—'}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </>
  )
}
