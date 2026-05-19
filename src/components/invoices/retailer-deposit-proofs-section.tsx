import { getLocale, getTranslations } from 'next-intl/server'
import { formatDateTimeShort, normalizeAppLocale } from '@/lib/format-datetime'
import { formatMoney } from '@/lib/format-money'
import type { RetailerDepositProofRow } from '@/lib/data/deposit-proofs-retailer'

type Props = {
  proofs: RetailerDepositProofRow[]
}

const STATUS_RING: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-900/40',
  confirmed: 'bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-100 dark:ring-emerald-900/40',
  rejected: 'bg-rose-50 text-rose-900 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-100 dark:ring-rose-900/40',
}

export async function RetailerDepositProofsSection({ proofs }: Props) {
  if (!proofs.length) return null

  const t = await getTranslations('RetailerDepositProofs')
  const locale = normalizeAppLocale(await getLocale())

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{t('title')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t('subtitle')}</p>
      </div>
      <ul className="space-y-3">
        {proofs.map((p) => (
          <li key={p.id} className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-lg font-semibold tabular-nums text-foreground">
                  {formatMoney(p.amount, p.payment_currency)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('submittedAt', { date: formatDateTimeShort(p.created_at, locale) })}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_RING[p.status] ?? STATUS_RING.pending}`}
              >
                {t(`status_${p.status}`)}
              </span>
            </div>
            {(p.bank_name || p.branch) && (
              <p className="mt-2 text-sm text-foreground">
                {[p.bank_name, p.branch].filter(Boolean).join(' · ') || '—'}
              </p>
            )}
            {p.reference_note ? (
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">{t('reference')}:</span> {p.reference_note}
              </p>
            ) : null}
            {p.status === 'rejected' && p.reject_reason ? (
              <p className="mt-2 rounded-md border border-rose-200 bg-rose-50/80 px-3 py-2 text-xs text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
                <span className="font-semibold">{t('rejectReason')}:</span> {p.reject_reason}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
