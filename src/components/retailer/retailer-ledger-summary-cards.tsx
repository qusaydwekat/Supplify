import { getTranslations } from 'next-intl/server'
import { formatLedgerMoney } from '@/lib/data/ledger'
import { cn } from '@/lib/utils'

type Props = {
  totalInvoiced: number
  totalCollected: number
  netBalance: number
  currency: string
}

export async function RetailerLedgerSummaryCards({ totalInvoiced, totalCollected, netBalance, currency }: Props) {
  const t = await getTranslations('LedgerPage')
  const owing = netBalance > 0.005

  return (
    <section className="grid gap-3 sm:grid-cols-3 sm:gap-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('totalInvoiced')}</p>
        <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground">
          {formatLedgerMoney(totalInvoiced, currency)}
        </p>
      </div>
      <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20 sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-200">{t('totalPaid')}</p>
        <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-emerald-800 dark:text-emerald-100">
          {formatLedgerMoney(totalCollected, currency)}
        </p>
      </div>
      <div
        className={cn(
          'rounded-2xl border p-4 shadow-sm sm:p-5',
          owing
            ? 'border-amber-200/80 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20'
            : 'border-border bg-card',
        )}
      >
        <p
          className={cn(
            'text-xs font-medium uppercase tracking-wide',
            owing ? 'text-amber-800 dark:text-amber-200' : 'text-muted-foreground',
          )}
        >
          {t('outstanding')}
        </p>
        <p
          className={cn(
            'mt-2 text-2xl font-bold tabular-nums tracking-tight',
            owing ? 'text-amber-900 dark:text-amber-100' : 'text-foreground',
          )}
        >
          {formatLedgerMoney(netBalance, currency)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t('retailerOutstandingHint')}</p>
      </div>
    </section>
  )
}
