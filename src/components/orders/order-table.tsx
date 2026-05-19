import type { ReactNode } from 'react'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { ReorderFromDeliveredOrderButton } from '@/components/orders/reorder-from-order-button'
import { formatDateTimeShort, normalizeAppLocale } from '@/lib/format-datetime'
import { formatMoney } from '@/lib/format-money'
import type { OrderListRow } from '@/lib/data/orders'

type Props = {
  rows: OrderListRow[]
  basePath: string
  showReorder?: boolean
  footer?: ReactNode
}

export async function OrderTable({ rows, basePath, showReorder, footer }: Props) {
  const t = await getTranslations('OrdersTable')
  const locale = normalizeAppLocale(await getLocale())

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
        {showReorder ? (
          <Link
            href="/retailer/browse"
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            {t('emptyBrowseCta')}
          </Link>
        ) : null}
        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>
    )
  }

  return (
    <div className="app-surface overflow-hidden rounded-2xl">
      <ul className="divide-y divide-border/80 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link
                  href={`${basePath}/${row.id}`}
                  className="font-mono text-sm font-semibold text-foreground underline-offset-2 hover:underline"
                >
                  {row.id.slice(0, 8)}…
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTimeShort(row.created_at, locale)}</p>
              </div>
              <OrderStatusBadge status={row.status} />
            </div>
            <p className="mt-2 truncate text-sm text-muted-foreground">{row.counterparty}</p>
            <p className="mt-1 line-clamp-2 text-sm text-foreground">{row.preview}</p>
            <div className="mt-3 flex items-center justify-between border-t border-border/80 pt-3">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('total')}</span>
              <span className="text-lg font-bold tabular-nums text-foreground">{formatMoney(row.total_price, row.currency_code)}</span>
            </div>
            {showReorder && row.status === 'delivered' ? (
              <div className="mt-3 flex justify-end">
                <ReorderFromDeliveredOrderButton orderId={row.id} compact />
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto [-webkit-overflow-scrolling:touch] md:block">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/80 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t('order')}</th>
              <th className="px-4 py-3">{t('date')}</th>
              <th className="px-4 py-3">{t('party')}</th>
              <th className="px-4 py-3">{t('items')}</th>
              <th className="px-4 py-3 text-end">{t('total')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              {showReorder ? <th className="px-4 py-3 text-end">{t('actions')}</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {rows.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-muted/50">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`${basePath}/${row.id}`} className="text-foreground underline-offset-2 hover:underline">
                    {row.id.slice(0, 8)}…
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDateTimeShort(row.created_at, locale)}</td>
                <td className="max-w-[180px] truncate px-4 py-3 text-foreground">{row.counterparty}</td>
                <td className="max-w-[220px] truncate px-4 py-3 text-muted-foreground">{row.preview}</td>
                <td className="px-4 py-3 text-end font-medium tabular-nums text-foreground">
                  {formatMoney(row.total_price, row.currency_code)}
                </td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={row.status} />
                </td>
                {showReorder ? (
                  <td className="px-4 py-3 text-end">
                    {row.status === 'delivered' ? (
                      <ReorderFromDeliveredOrderButton orderId={row.id} compact />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  )
}
