import type { AppLocale } from '@/i18n/routing'
import { defaultLocale } from '@/i18n/routing'
import { formatDateMedium } from '@/lib/format-datetime'
import { formatMoney } from '@/lib/format-money'
import type { InstallmentRow } from '@/lib/invoices-types'

type Labels = {
  title: string
  colDue: string
  colScheduled: string
  colPaid: string
  colRemaining: string
}

export function InvoiceInstallmentsTable({
  installments,
  currencyCode,
  labels,
  locale,
}: {
  installments: InstallmentRow[]
  currencyCode: string
  labels: Labels
  locale?: AppLocale
}) {
  if (!installments.length) return null

  const loc = locale ?? defaultLocale
  const fmtDue = (iso: string) => formatDateMedium(iso, loc)

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-foreground">{labels.title}</h2>

      <ul className="space-y-3 md:hidden">
        {installments.map((row) => (
          <li key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-border dark:bg-card">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
                #{row.seq}
              </span>
              <span className="text-sm text-muted-foreground">{fmtDue(row.due_date)}</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{labels.colScheduled}</dt>
                <dd className="mt-0.5 tabular-nums text-foreground">{formatMoney(row.amount_due, currencyCode)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{labels.colPaid}</dt>
                <dd className="mt-0.5 tabular-nums text-emerald-800 dark:text-emerald-400">
                  {formatMoney(row.paid_toward, currencyCode)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{labels.colRemaining}</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
                  {formatMoney(row.remaining, currencyCode)}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 dark:border-border md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-start text-xs font-medium uppercase text-slate-500 dark:bg-muted/80 dark:text-muted-foreground">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">{labels.colDue}</th>
              <th className="px-4 py-2 text-end">{labels.colScheduled}</th>
              <th className="px-4 py-2 text-end">{labels.colPaid}</th>
              <th className="px-4 py-2 text-end">{labels.colRemaining}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-border/80">
            {installments.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-2 text-slate-600 dark:text-muted-foreground">{row.seq}</td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-800 dark:text-foreground">{fmtDue(row.due_date)}</td>
                <td className="px-4 py-2 text-end tabular-nums">{formatMoney(row.amount_due, currencyCode)}</td>
                <td className="px-4 py-2 text-end tabular-nums text-emerald-800 dark:text-emerald-400">
                  {formatMoney(row.paid_toward, currencyCode)}
                </td>
                <td className="px-4 py-2 text-end font-medium tabular-nums">{formatMoney(row.remaining, currencyCode)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
