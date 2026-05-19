'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { confirmDepositProof, rejectDepositProof } from '@/lib/actions/deposit-proofs'

export function DepositProofActions({ id }: { id: string }) {
  const t = useTranslations('DepositProofsInbox')
  const router = useRouter()
  const [pending, start] = useTransition()
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        className="min-h-8 px-3 py-1 text-xs"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await confirmDepositProof({ depositProofId: id })
            if (res.error) toast.error(res.error)
            else {
              toast.success(t('confirmedToast'))
              router.refresh()
            }
          })
        }
      >
        {t('confirm')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="min-h-8 px-3 py-1 text-xs"
        disabled={pending}
        onClick={() => setShowReject((v) => !v)}
      >
        {t('reject')}
      </Button>
      {showReject ? (
        <div className="w-64 rounded-md border border-rose-200 bg-rose-50 p-2 dark:border-rose-900/50 dark:bg-rose-950/30">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('rejectReasonPlaceholder')}
          />
          <Button
            type="button"
            variant="primary"
            className="mt-2 min-h-8 w-full bg-rose-600 px-3 py-1 text-xs hover:bg-rose-700"
            disabled={pending || reason.trim().length < 3}
            onClick={() =>
              start(async () => {
                const res = await rejectDepositProof({ depositProofId: id, reason })
                if (res.error) toast.error(res.error)
                else {
                  toast.success(t('rejectedToast'))
                  setShowReject(false)
                  router.refresh()
                }
              })
            }
          >
            {t('confirmReject')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
