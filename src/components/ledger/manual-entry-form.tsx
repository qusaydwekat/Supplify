'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Plus, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addManualLedgerEntry } from '@/lib/actions/ledger'
import type { LedgerFilterOption } from '@/lib/data/ledger'

type Props = {
  retailers: LedgerFilterOption[]
}

export function ManualEntryForm({ retailers }: Props) {
  const t = useTranslations('LedgerPage')
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'credit_note' | 'debit_note'>('credit_note')
  const [retailerId, setRetailerId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const res = await addManualLedgerEntry({ retailerId, type, amount: Number(amount), description })
    setSubmitting(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('manualEntrySuccess'))
    setAmount('')
    setDescription('')
    setOpen(false)
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} className="print:hidden">
        {t('addManualEntry')}
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-4 space-y-3 print:hidden">
      <h3 className="text-sm font-semibold text-foreground">{t('addManualEntry')}</h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="form-label" htmlFor="me-retailer">{t('colRetailer')}</label>
          <select
            id="me-retailer"
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            value={retailerId}
            onChange={(e) => setRetailerId(e.target.value)}
            required
          >
            <option value="">{t('selectRetailer')}</option>
            {retailers.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">{t('entryType')}</label>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => setType('credit_note')}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition ${type === 'credit_note' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-border text-muted-foreground'}`}
            >
              <Minus className="h-3.5 w-3.5" />
              {t('creditNote')}
            </button>
            <button
              type="button"
              onClick={() => setType('debit_note')}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition ${type === 'debit_note' ? 'border-red-500 bg-red-50 text-red-700' : 'border-border text-muted-foreground'}`}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('debitNote')}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="form-label" htmlFor="me-amount">{t('entryAmount')}</label>
          <Input
            id="me-amount"
            type="number"
            step="0.01"
            min="0.01"
            className="mt-1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="form-label" htmlFor="me-desc">{t('entryDescription')}</label>
          <Input
            id="me-desc"
            className="mt-1"
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? t('saving') : t('saveEntry')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {t('cancelEntry')}
        </Button>
      </div>
    </form>
  )
}
