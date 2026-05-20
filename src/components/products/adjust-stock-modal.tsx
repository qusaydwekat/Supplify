'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { adjustStock } from '@/lib/actions/products'
import type { StockAdjustmentReason } from '@/lib/types/products'
import { STOCK_ADJUSTMENT_REASONS } from '@/lib/types/products'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  variationId: string
  variationName: string
  currentStock: number
  open: boolean
  onClose: () => void
}

export function AdjustStockModal({ variationId, variationName, currentStock, open, onClose }: Props) {
  const t = useTranslations('StockAdjustments')
  const router = useRouter()
  const [delta, setDelta] = useState('0')
  const [reason, setReason] = useState<StockAdjustmentReason>('count_correction')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)

  if (!open) return null

  async function submit() {
    const qty = parseInt(delta, 10)
    if (!Number.isFinite(qty) || qty === 0) {
      toast.error(t('deltaRequired'))
      return
    }
    const next = currentStock + qty
    if (next < 0) {
      toast.error(t('negativeStock'))
      return
    }

    setPending(true)
    const res = await adjustStock(variationId, qty, reason, note)
    setPending(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('success'))
    onClose()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-lg">
        <h3 className="text-base font-semibold text-foreground">{t('title')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{variationName}</p>
        <p className="mt-2 text-sm">
          {t('currentStock')}: <span className="font-semibold tabular-nums">{currentStock}</span>
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t('deltaLabel')}</label>
            <Input
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              className="mt-1"
              placeholder={t('deltaPlaceholder')}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t('deltaHint')}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t('reasonLabel')}</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as StockAdjustmentReason)}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              {STOCK_ADJUSTMENT_REASONS.map((code) => (
                <option key={code} value={code}>
                  {t(`reason_${code}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t('noteLabel')}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              placeholder={t('notePlaceholder')}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            {t('cancel')}
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={pending}>
            {pending ? t('saving') : t('apply')}
          </Button>
        </div>
      </div>
    </div>
  )
}
