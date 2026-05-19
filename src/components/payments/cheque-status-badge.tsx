import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/utils'
import type { ChequeStatus } from '@/lib/invoices-types'

const STATUS_COLOR: Record<ChequeStatus, string> = {
  pending_due: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  deposited: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200',
  cleared: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  bounced: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200',
  replaced: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
}

type Props = {
  method?: string | null
  status?: ChequeStatus | null
  bounceReason?: string | null
  /** Show bounce reason under the badge when status is bounced */
  showBounceDetail?: boolean
}

export async function ChequeStatusBadge({ method, status, bounceReason, showBounceDetail = false }: Props) {
  if (method !== 'cheque') {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const t = await getTranslations('ChequeCycle')
  const resolved: ChequeStatus = status ?? 'pending_due'

  return (
    <div className="flex flex-col gap-1">
      <span className={cn('inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLOR[resolved])}>
        {t(`status_${resolved}`)}
      </span>
      {showBounceDetail && resolved === 'bounced' ? (
        <p className="max-w-[220px] text-xs text-muted-foreground">
          {bounceReason ? (
            <>
              <span className="font-medium text-rose-800 dark:text-rose-200">{t('bounceReasonFromSupplier')}:</span>{' '}
              {bounceReason}
            </>
          ) : (
            t('retailerBouncedBalanceNote')
          )}
        </p>
      ) : null}
    </div>
  )
}
