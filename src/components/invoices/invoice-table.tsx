import type { ReactNode } from 'react'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge'
import { formatDateShort, normalizeAppLocale } from '@/lib/format-datetime'
import { formatMoney } from '@/lib/format-money'
import type { InvoiceListRow } from '@/lib/invoices-types'

type Props = {
  rows: InvoiceListRow[]
  basePath: string
  footer?: ReactNode
}

export async function InvoiceTable({ rows, basePath, footer }: Props) {
  const t = await getTranslations('InvoicesTable')
  const locale = normalizeAppLocale(await getLocale())

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>
    )
  }

  return (
    <div className="app-surface overflow-hidden rounded-2xl">
      <ul className="divide-y divide-border/80 md:hidden">
        {rows.map((row) => {
          const balance =
            row.balances_unavailable || row.remaining == null ? null : Math.max(0, row.remaining)
          const nextDue =
            row.balances_unavailable || !row.next_installment_due ? null : row.next_installment_due

          return (
            <li key={row.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link href={`${basePath}/${row.id}`} className="font-semibold text-foreground underline-offset-2 hover:underline">
                  {row.invoice_number}
                </Link>
                <InvoiceStatusBadge status={row.status} dueDate={row.due_date} />
              </div>
              <p className="mt-2 truncate text-xs text-muted-foreground">{row.counterparty}</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('issued')}</dt>
                  <dd className="mt-0.5 text-foreground">{formatDateShort(row.issued_at, locale)}</dd>
                </div>
                <div className="text-end">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('total')}</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-foreground">{formatMoney(row.total, row.currency_code)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('balance')}</dt>
                  <dd
                    className="mt-0.5 font-semibold tabular-nums text-foreground"
                    title={row.balances_unavailable ? t('balanceUnavailableHint') : undefined}
                  >
                    {balance == null ? '—' : formatMoney(balance, row.currency_code)}
                  </dd>
                </div>
                <div className="text-end">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('nextDue')}</dt>
                  <dd className="mt-0.5 text-foreground">{nextDue ? formatDateShort(nextDue, locale) : '—'}</dd>
                </div>
              </dl>
            </li>
          )
        })}
      </ul>

      <div className="hidden overflow-x-auto [-webkit-overflow-scrolling:touch] md:block">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/80 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t('invoice')}</th>
              <th className="px-4 py-3">{t('issued')}</th>
              <th className="px-4 py-3">{t('party')}</th>
              <th className="px-4 py-3 text-end">{t('total')}</th>
              <th className="px-4 py-3 text-end">{t('balance')}</th>
              <th className="px-4 py-3">{t('nextDue')}</th>
              <th className="px-4 py-3">{t('status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {rows.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-muted/50">
                <td className="px-4 py-3">
                  <Link href={`${basePath}/${row.id}`} className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-foreground">
                    {row.invoice_number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-muted-foreground">{formatDateShort(row.issued_at, locale)}</td>
                <td className="max-w-[200px] truncate px-4 py-3 text-slate-800 dark:text-foreground">{row.counterparty}</td>
                <td className="px-4 py-3 text-end font-medium tabular-nums text-slate-900 dark:text-foreground">
                  {formatMoney(row.total, row.currency_code)}
                </td>
                <td
                  className="px-4 py-3 text-end font-medium tabular-nums text-slate-900 dark:text-foreground"
                  title={row.balances_unavailable ? t('balanceUnavailableHint') : undefined}
                >
                  {row.balances_unavailable || row.remaining == null ? '—' : formatMoney(Math.max(0, row.remaining), row.currency_code)}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-muted-foreground">
                  {row.balances_unavailable ? '—' : row.next_installment_due ? formatDateShort(row.next_installment_due, locale) : '—'}
                </td>
                <td className="px-4 py-3">
                  <InvoiceStatusBadge status={row.status} dueDate={row.due_date} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  )
}
