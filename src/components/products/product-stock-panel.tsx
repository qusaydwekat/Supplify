import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { MovementHistoryTable } from '@/components/products/movement-history-table'
import type { VariationMovementRow } from '@/lib/types/products'
import { isVariationLowStock } from '@/lib/types/products'
import { cn } from '@/lib/utils'

type VariationStock = {
  id: string
  name: string
  stock_quantity: number
  min_order_quantity: number
  reorder_point: number | null
  reorder_qty: number | null
}

type Props = {
  productId: string
  variations: VariationStock[]
  movements: (VariationMovementRow & { variationName?: string })[]
}

export async function ProductStockPanel({ productId, variations, movements }: Props) {
  const t = await getTranslations('ProductHub')
  const tMove = await getTranslations('StockMovements')

  const totalStock = variations.reduce((s, v) => s + v.stock_quantity, 0)
  const lowCount = variations.filter((v) =>
    isVariationLowStock(v.stock_quantity, v.min_order_quantity, v.reorder_point),
  ).length

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('stockTotalUnits')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{totalStock}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('stockSkuCount')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{variations.length}</p>
        </div>
        <div
          className={cn(
            'rounded-xl border p-4 shadow-sm',
            lowCount > 0 ? 'border-amber-200 bg-amber-50/60' : 'border-border bg-card',
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">{t('stockLowSkus')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-950">{lowCount}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">{t('stockBySku')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-start font-medium">{t('colSku')}</th>
                <th className="px-4 py-2 text-end font-medium">{t('colStock')}</th>
                <th className="px-4 py-2 text-end font-medium">{t('colReorderAt')}</th>
                <th className="px-4 py-2 text-end font-medium">{t('colReorderQty')}</th>
                <th className="px-4 py-2 text-end font-medium">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/80">
              {variations.map((v) => {
                const low = isVariationLowStock(v.stock_quantity, v.min_order_quantity, v.reorder_point)
                const threshold = v.reorder_point ?? Math.max(v.min_order_quantity * 2, 1)
                return (
                  <tr key={v.id} className={cn(low && 'bg-amber-50/70')}>
                    <td className="px-4 py-2 font-medium">{v.name}</td>
                    <td className="px-4 py-2 text-end tabular-nums">{v.stock_quantity}</td>
                    <td className="px-4 py-2 text-end tabular-nums">{threshold}</td>
                    <td className="px-4 py-2 text-end tabular-nums">{v.reorder_qty ?? '—'}</td>
                    <td className="px-4 py-2 text-end">
                      <Link
                        href={`/supplier/products/${productId}?tab=skus`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {t('adjustOnSkusTab')}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <MovementHistoryTable rows={movements} title={tMove('productTitle')} />
    </div>
  )
}
