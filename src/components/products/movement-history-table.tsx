import { getLocale, getTranslations } from 'next-intl/server'
import { formatDateTimeShort, normalizeAppLocale } from '@/lib/format-datetime'
import type { VariationMovementRow } from '@/lib/types/products'

type Row = VariationMovementRow & { variationName?: string }

type Props = {
  rows: Row[]
  title?: string
}

export async function MovementHistoryTable({ rows, title }: Props) {
  const t = await getTranslations('StockMovements')
  const locale = normalizeAppLocale(await getLocale())
  const fmt = (d: string) => formatDateTimeShort(d, locale)

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title ?? t('title')}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{t('colWhen')}</th>
                {rows.some((r) => r.variationName) ? (
                  <th className="px-3 py-2 text-start font-medium">{t('colSku')}</th>
                ) : null}
                <th className="px-3 py-2 text-start font-medium">{t('colType')}</th>
                <th className="px-3 py-2 text-end font-medium">{t('colQty')}</th>
                <th className="px-3 py-2 text-end font-medium">{t('colStockAfter')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('colNote')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/80">
              {rows.map((row) => {
                const signed =
                  row.movementType === 'adjustment'
                    ? row.adjustmentIncrease
                      ? row.quantity
                      : -row.quantity
                    : row.movementType === 'sale' || row.movementType === 'damage'
                      ? -row.quantity
                      : row.quantity
                return (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 text-muted-foreground">{fmt(row.createdAt)}</td>
                    {rows.some((r) => r.variationName) ? (
                      <td className="px-3 py-2">{row.variationName ?? '—'}</td>
                    ) : null}
                    <td className="px-3 py-2">{t(`type_${row.movementType}` as 'type_adjustment')}</td>
                    <td
                      className={`px-3 py-2 text-end tabular-nums font-medium ${signed >= 0 ? 'text-emerald-700' : 'text-red-700'}`}
                    >
                      {signed >= 0 ? '+' : ''}
                      {signed}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">{row.stockAfter}</td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-muted-foreground">{row.notes ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
