'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  markChequeBounced,
  markChequeCleared,
  markChequeDeposited,
} from '@/lib/actions/cheque-cycle'
import type { ChequeStatus, PaymentRow } from '@/lib/invoices-types'

type Props = {
  paymentId: string
  chequeStatus: ChequeStatus | null
  chequeDate: string | null
}

const STATUS_COLOR: Record<ChequeStatus, string> = {
  pending_due: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  deposited: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200',
  cleared: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  bounced: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200',
  replaced: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
}

export function ChequeStatusRetailerRow({ payment }: { payment: PaymentRow }) {
  const t = useTranslations('ChequeCycle')
  if (payment.method !== 'cheque') return null

  const status: ChequeStatus = payment.cheque_status ?? 'pending_due'
  const isDueToday =
    !!payment.cheque_date &&
    new Date(payment.cheque_date).getTime() <= new Date().setHours(23, 59, 59, 999)

  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-100 bg-slate-50/80 px-2 py-2 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[status]}`}>
          {t(`status_${status}`)}
        </span>
        {status === 'pending_due' && isDueToday ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {t('dueNow')}
          </span>
        ) : null}
      </div>
      {status === 'bounced' ? (
        <>
          <p className="text-xs text-slate-600 dark:text-slate-400">{t('retailerBouncedBalanceNote')}</p>
          {payment.cheque_bounce_reason ? (
            <p className="text-xs text-rose-800 dark:text-rose-200">
              <span className="font-medium">{t('bounceReasonFromSupplier')}:</span>{' '}
              {payment.cheque_bounce_reason}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export function ChequeActions({ paymentId, chequeStatus, chequeDate }: Props) {
  const t = useTranslations('ChequeCycle')
  const [pending, startTransition] = useTransition()
  const [showBounce, setShowBounce] = useState(false)
  const [reason, setReason] = useState('')

  const status: ChequeStatus = chequeStatus ?? 'pending_due'
  const isDueToday =
    chequeDate && new Date(chequeDate).getTime() <= new Date().setHours(23, 59, 59, 999)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[status]}`}
        >
          {t(`status_${status}`)}
        </span>
        {status === 'pending_due' && isDueToday ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {t('dueNow')}
          </span>
        ) : null}
      </div>
      {status !== 'cleared' && status !== 'bounced' ? (
        <div className="flex flex-wrap gap-2">
          {status === 'pending_due' ? (
            <Button
              type="button"
              variant="secondary"
              className="min-h-8 px-3 py-1 text-xs"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await markChequeDeposited(paymentId)
                  if (res.error) toast.error(res.error)
                  else toast.success(t('depositedToast'))
                })
              }
            >
              {t('actionDeposit')}
            </Button>
          ) : null}
          {status === 'deposited' || status === 'pending_due' ? (
            <Button
              type="button"
              variant="secondary"
              className="min-h-8 px-3 py-1 text-xs"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await markChequeCleared(paymentId)
                  if (res.error) toast.error(res.error)
                  else toast.success(t('clearedToast'))
                })
              }
            >
              {t('actionClear')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="min-h-8 px-3 py-1 text-xs"
            disabled={pending}
            onClick={() => setShowBounce((v) => !v)}
          >
            {t('actionBounce')}
          </Button>
        </div>
      ) : null}
      {status === 'bounced' ? (
        <p className="text-xs text-rose-700 dark:text-rose-300">{t('bouncedHint')}</p>
      ) : null}
      {showBounce ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-2 dark:border-rose-900/50 dark:bg-rose-950/30">
          <label className="text-xs font-medium text-rose-800 dark:text-rose-200">
            {t('bounceReason')}
          </label>
          <Input
            className="mt-1.5"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('bounceReasonPlaceholder')}
          />
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              variant="primary"
              className="min-h-8 bg-rose-600 px-3 py-1 text-xs hover:bg-rose-700"
              disabled={pending || reason.trim().length < 3}
              onClick={() =>
                startTransition(async () => {
                  const res = await markChequeBounced(paymentId, reason.trim())
                  if (res.error) toast.error(res.error)
                  else {
                    toast.success(t('bouncedToast'))
                    setShowBounce(false)
                    setReason('')
                  }
                })
              }
            >
              {t('confirmBounce')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-8 px-3 py-1 text-xs"
              onClick={() => {
                setShowBounce(false)
                setReason('')
              }}
            >
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
