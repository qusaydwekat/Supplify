import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/utils'

type Props = {
  totalInvoiced: number
  totalCollected: number
  outstanding: number
  /** ISO 4217 code for formatting */
  currency?: string
  /** Shown under the bar */
  caption?: string
  ledgerHref?: string
}

function fmtMoney(n: number, currency: string) {
  return new Intl.NumberFormat('ar', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
}

export async function BalanceOverview({
  totalInvoiced,
  totalCollected,
  outstanding,
  currency = 'USD',
  caption,
  ledgerHref = '/supplier/ledger',
}: Props) {
  const t = await getTranslations('BalanceOverview')
  const captionText = caption ?? t('caption')
  const invoiced = Math.max(0, totalInvoiced)
  const collected = Math.max(0, totalCollected)
  const out = Math.max(0, outstanding)

  const denom = invoiced > 0 ? invoiced : collected + out > 0 ? collected + out : 1
  const collectedPct = Math.min(100, Math.round((collected / denom) * 1000) / 10)
  const outstandingPct = Math.min(100, Math.round((out / denom) * 1000) / 10)
  const remainder = Math.max(0, Math.round((100 - collectedPct - outstandingPct) * 10) / 10)

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm shadow-slate-900/5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{t('title')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{captionText}</p>
        </div>
        <Link href={ledgerHref} className="text-xs font-semibold text-primary underline-offset-2 hover:underline">
          {t('openLedger')}
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:gap-3 sm:text-left">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t('invoiced')}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{fmtMoney(invoiced, currency)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">{t('collected')}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-emerald-800">{fmtMoney(collected, currency)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">{t('outstanding')}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-amber-950">{fmtMoney(out, currency)}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" title={t('barHint')}>
          <div
            className={cn('h-full bg-emerald-600 transition-[width]', collectedPct <= 0 && 'hidden')}
            style={{ width: `${collectedPct}%` }}
          />
          <div
            className={cn('h-full bg-amber-400 transition-[width]', outstandingPct <= 0 && 'hidden')}
            style={{ width: `${outstandingPct}%` }}
          />
          {remainder > 0 && (
            <div className="h-full bg-border" style={{ width: `${remainder}%` }} title={t('barHint')} />
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{t('barHint')}</p>
      </div>
    </div>
  )
}
