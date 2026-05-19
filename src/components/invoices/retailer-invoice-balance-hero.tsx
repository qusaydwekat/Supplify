import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import type { InvoiceStatus } from '@/lib/invoices-types'
import { formatDateMedium, normalizeAppLocale } from '@/lib/format-datetime'
import { formatMoney } from '@/lib/format-money'
import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge'

type Props = {
  invoiceNumber: string
  status: InvoiceStatus
  counterparty: string
  currencyCode: string
  total: number
  paidTotal: number
  remaining: number
  dueDate: string | null
  orderId: string
}

export async function RetailerInvoiceBalanceHero({
  invoiceNumber,
  status,
  counterparty,
  currencyCode,
  total,
  paidTotal,
  remaining,
  dueDate,
  orderId,
}: Props) {
  const t = await getTranslations('RetailerInvoiceHero')
  const locale = normalizeAppLocale(await getLocale())
  const fmtDue = (d: string | null) => formatDateMedium(d, locale)

  const overdue =
    remaining > 0.009 &&
    dueDate &&
    status !== 'paid' &&
    new Date(dueDate).setHours(23, 59, 59, 999) < Date.now()

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/40 shadow-sm">
      <div className="border-b border-border/80 bg-muted/30 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{counterparty}</p>
            <p className="mt-1 truncate text-lg font-semibold text-foreground sm:text-xl">{invoiceNumber}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <InvoiceStatusBadge status={status} dueDate={dueDate} />
              {overdue ? (
                <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-medium text-destructive">
                  {t('overdueBadge')}
                </span>
              ) : null}
            </div>
          </div>
          <Link
            href={`/retailer/orders/${orderId}`}
            className="shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground shadow-sm transition hover:bg-muted sm:text-sm"
          >
            {t('viewOrder')}
          </Link>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-3 sm:gap-6 sm:p-6">
        <div className="rounded-xl border border-border/80 bg-background/80 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('invoiceTotal')}</p>
          <p className="mt-2 text-xl font-bold tabular-nums text-foreground sm:text-2xl">{formatMoney(total, currencyCode)}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-background/80 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('paidSoFar')}</p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 sm:text-2xl">
            {formatMoney(paidTotal, currencyCode)}
          </p>
        </div>
        <div
          className={`rounded-xl border p-4 ${
            remaining > 0.009
              ? overdue
                ? 'border-destructive/40 bg-destructive/5'
                : 'border-primary/30 bg-primary/5'
              : 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20'
          }`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('balanceDue')}</p>
          <p className="mt-2 text-xl font-bold tabular-nums text-foreground sm:text-2xl">{formatMoney(Math.max(0, remaining), currencyCode)}</p>
          {dueDate ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t('dueDate')}: <span className="font-medium text-foreground">{fmtDue(dueDate)}</span>
            </p>
          ) : null}
          {remaining <= 0.009 ? (
            <p className="mt-2 text-xs font-medium text-emerald-800 dark:text-emerald-300">{t('fullyPaid')}</p>
          ) : overdue ? (
            <p className="mt-2 text-xs font-medium text-destructive">{t('overdueHint')}</p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">{t('payPrompt')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
