import type { ReactNode } from 'react'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { formatPaymentMoney, type SupplierPaymentRow } from '@/lib/data/payments'
import { formatDateMedium, formatDateTimeShort, normalizeAppLocale } from '@/lib/format-datetime'
import { formatPaymentReferenceParts } from '@/lib/format-payment-reference'

type Props = {
  rows: SupplierPaymentRow[]
  /** Precomputed page total in the currency you want to display. */
  pageTotalAmount: number
  pageTotalCurrency: string
  footer?: ReactNode
}

export async function SupplierPaymentsTable({ rows, pageTotalAmount, pageTotalCurrency, footer }: Props) {
  const locale = normalizeAppLocale(await getLocale())
  const tRef = await getTranslations('InvoiceDetailPage')

  const fmtChequeDate = (iso: string) => formatDateMedium(iso, locale)

  if (!rows.length) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          No payments recorded yet. Record payments from an{' '}
          <Link href="/supplier/invoices" className="font-medium text-primary underline underline-offset-2">
            invoice
          </Link>
          .
        </p>
        {footer}
      </div>
    )
  }

  return (
    <div className="app-surface">
      <p className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
        Page total ({pageTotalCurrency}):{' '}
        <span className="font-semibold text-foreground">{formatPaymentMoney(pageTotalAmount, pageTotalCurrency)}</span>
      </p>
      <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/80 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Retailer</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {rows.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-muted/50">
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                  {formatDateTimeShort(row.created_at, locale)}
                </td>
                <td className="px-4 py-2">
                  <Link
                    href={`/supplier/invoices/${row.invoice_id}`}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                  >
                    {row.invoice_number}
                  </Link>
                </td>
                <td className="max-w-[160px] truncate px-4 py-2 text-slate-800">{row.retailer_label}</td>
                <td className="px-4 py-2 text-right font-medium tabular-nums text-slate-900">
                  <div>{formatPaymentMoney(row.amount, row.invoice_currency)}</div>
                  {row.payment_currency !== row.invoice_currency ? (
                    <div className="text-xs font-normal text-slate-500">
                      {formatPaymentMoney(row.payment_amount, row.payment_currency)}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-2 capitalize text-slate-700">{row.method}</td>
                <td className="max-w-[min(100vw,240px)] px-4 py-2 text-slate-600">
                  {(() => {
                    const parts = formatPaymentReferenceParts(
                      row,
                      fmtChequeDate,
                      (v) => tRef('chequeMetaLine', v),
                    )
                    return (
                      <div className="space-y-0.5 break-words">
                        <div>{parts.primary}</div>
                        {parts.note ? <div className="text-xs text-slate-500">{parts.note}</div> : null}
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
