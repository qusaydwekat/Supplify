import type { ReactNode } from 'react'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { formatPaymentMoney, type RetailerPaymentRow } from '@/lib/data/payments'
import { formatDateMedium, formatDateTimeShort, normalizeAppLocale } from '@/lib/format-datetime'
import { formatPaymentReferenceParts } from '@/lib/format-payment-reference'
import { ChequeStatusBadge } from '@/components/payments/cheque-status-badge'

type Props = {
  rows: RetailerPaymentRow[]
  defaultAppCurrency: string
  footer?: ReactNode
}

function paymentMethodKey(m: string): 'cash' | 'bank' | 'cheque' | 'other' | null {
  if (m === 'cash' || m === 'bank' || m === 'cheque' || m === 'other') return m
  return null
}

export async function RetailerPaymentsTable({ rows, defaultAppCurrency, footer }: Props) {
  const locale = normalizeAppLocale(await getLocale())
  const tRef = await getTranslations('InvoiceDetailPage')
  const t = await getTranslations('PaymentsList')
  const tPay = await getTranslations('PaymentMethods')

  const fmtChequeDate = (iso: string) => formatDateMedium(iso, locale)
  const methodLabel = (m: string) => {
    const key = paymentMethodKey(m)
    return key ? tPay(key) : m
  }

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">{t('retailerPaymentsEmpty')}</p>
        <Link
          href="/retailer/invoices"
          className="mt-4 inline-flex items-center justify-center rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted"
        >
          {t('linkRetailerInvoices')}
        </Link>
        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>
    )
  }

  const totalInDefault = Math.round(rows.reduce((s, r) => s + r.amount_in_default_currency, 0) * 100) / 100

  return (
    <div className="app-surface">
      <p className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
        {t('pageTotalLabel', { currency: defaultAppCurrency })}{' '}
        <span className="font-semibold text-foreground">{formatPaymentMoney(totalInDefault, defaultAppCurrency)}</span>
      </p>

      <ul className="divide-y divide-border/80 md:hidden">
        {rows.map((row) => {
          const parts = formatPaymentReferenceParts(row, fmtChequeDate, (v) => tRef('chequeMetaLine', v))
          return (
            <li key={row.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/retailer/invoices/${row.invoice_id}`}
                    className="font-semibold text-foreground underline-offset-2 hover:underline"
                  >
                    {row.invoice_number}
                  </Link>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{row.supplier_label}</p>
                </div>
                <span className="text-xs text-muted-foreground">{formatDateTimeShort(row.created_at, locale)}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('colAmount')}</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{formatPaymentMoney(row.amount, row.invoice_currency)}</p>
                  {row.payment_currency !== row.invoice_currency ? (
                    <p className="text-xs text-muted-foreground">{formatPaymentMoney(row.payment_amount, row.payment_currency)}</p>
                  ) : null}
                </div>
                <div className="text-end">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('colMethod')}</p>
                  <p className="mt-0.5 capitalize text-sm text-foreground">{methodLabel(row.method)}</p>
                </div>
              </div>
              {row.method === 'cheque' ? (
                <div className="mt-3 border-t border-border/80 pt-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('colChequeStatus')}</p>
                  <div className="mt-1.5">
                    <ChequeStatusBadge
                      method={row.method}
                      status={row.cheque_status}
                      bounceReason={row.cheque_bounce_reason}
                      showBounceDetail={row.cheque_status === 'bounced'}
                    />
                  </div>
                </div>
              ) : null}
              <div className="mt-3 border-t border-border/80 pt-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('colReference')}</p>
                <div className="mt-1 space-y-0.5 break-words text-sm text-muted-foreground">
                  <div>{parts.primary}</div>
                  {parts.note ? <div className="text-xs">{parts.note}</div> : null}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="hidden overflow-x-auto [-webkit-overflow-scrolling:touch] md:block">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/80 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t('colDate')}</th>
              <th className="px-4 py-3">{t('colSupplier')}</th>
              <th className="px-4 py-3">{t('colInvoice')}</th>
              <th className="px-4 py-3 text-right">{t('colAmount')}</th>
              <th className="px-4 py-3">{t('colMethod')}</th>
              <th className="px-4 py-3">{t('colChequeStatus')}</th>
              <th className="px-4 py-3">{t('colReference')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {rows.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-muted/50">
                <td className="whitespace-nowrap px-4 py-2 text-slate-600 dark:text-muted-foreground">
                  {formatDateTimeShort(row.created_at, locale)}
                </td>
                <td className="max-w-[160px] truncate px-4 py-2 text-slate-800 dark:text-foreground">{row.supplier_label}</td>
                <td className="px-4 py-2">
                  <Link
                    href={`/retailer/invoices/${row.invoice_id}`}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-foreground"
                  >
                    {row.invoice_number}
                  </Link>
                </td>
                <td className="px-4 py-2 text-right font-medium tabular-nums text-slate-900 dark:text-foreground">
                  <div>{formatPaymentMoney(row.amount, row.invoice_currency)}</div>
                  {row.payment_currency !== row.invoice_currency ? (
                    <div className="text-xs font-normal text-slate-500 dark:text-muted-foreground">
                      {formatPaymentMoney(row.payment_amount, row.payment_currency)}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-2 capitalize text-slate-700 dark:text-foreground">{methodLabel(row.method)}</td>
                <td className="px-4 py-2 align-top">
                  <ChequeStatusBadge
                    method={row.method}
                    status={row.cheque_status}
                    bounceReason={row.cheque_bounce_reason}
                    showBounceDetail={row.cheque_status === 'bounced'}
                  />
                </td>
                <td className="max-w-[min(100vw,240px)] px-4 py-2 text-slate-600 dark:text-muted-foreground">
                  {(() => {
                    const parts = formatPaymentReferenceParts(row, fmtChequeDate, (v) => tRef('chequeMetaLine', v))
                    return (
                      <div className="space-y-0.5 break-words">
                        <div>{parts.primary}</div>
                        {parts.note ? <div className="text-xs text-slate-500 dark:text-muted-foreground">{parts.note}</div> : null}
                      </div>
                    )
                  })()}
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
