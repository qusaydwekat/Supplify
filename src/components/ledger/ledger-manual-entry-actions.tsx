'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deleteManualLedgerEntry, updateManualLedgerEntry } from '@/lib/actions/ledger'
import type { LedgerFilterOption } from '@/lib/data/ledger'

type Props = {
  entryId: string
  entryType: 'credit_note' | 'debit_note'
  retailerId: string
  /** Absolute amount (positive) as entered when creating the note */
  amountAbs: number
  description: string
  retailers: LedgerFilterOption[]
}

export function LedgerManualEntryActions({
  entryId,
  entryType,
  retailerId: initialRetailerId,
  amountAbs,
  description: initialDescription,
  retailers,
}: Props) {
  const t = useTranslations('LedgerPage')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  const [retailerId, setRetailerId] = useState(initialRetailerId)
  const [amount, setAmount] = useState(String(amountAbs))
  const [description, setDescription] = useState(initialDescription)

  function resetForm() {
    setRetailerId(initialRetailerId)
    setAmount(String(amountAbs))
    setDescription(initialDescription)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const res = await updateManualLedgerEntry({
        entryId,
        retailerId,
        amount: Number(amount),
        description,
      })
      if (res.error) toast.error(res.error)
      else {
        toast.success(t('manualEntryUpdated'))
        setOpen(false)
        router.refresh()
      }
    })
  }

  function handleDelete() {
    if (!window.confirm(t('manualEntryDeleteConfirm'))) return
    start(async () => {
      const res = await deleteManualLedgerEntry({ entryId })
      if (res.error) toast.error(res.error)
      else {
        toast.success(t('manualEntryDeleted'))
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <>
      <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={() => { resetForm(); setOpen(true) }}>
        {t('editManualEntry')}
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-entry-edit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border px-4 py-3">
              <h2 id="manual-entry-edit-title" className="text-sm font-semibold text-foreground">
                {t('editManualEntry')}
              </h2>
              <p className="mt-1 text-xs capitalize text-muted-foreground">{entryType.replace('_', ' ')}</p>
            </div>
            <form onSubmit={handleSave} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                <div>
                  <label className="form-label" htmlFor={`me-retailer-${entryId}`}>
                    {t('colRetailer')}
                  </label>
                  <select
                    id={`me-retailer-${entryId}`}
                    className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                    value={retailerId}
                    onChange={(e) => setRetailerId(e.target.value)}
                    required
                  >
                    {retailers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor={`me-amt-${entryId}`}>
                    {t('entryAmount')}
                  </label>
                  <Input
                    id={`me-amt-${entryId}`}
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
                  <label className="form-label" htmlFor={`me-desc-${entryId}`}>
                    {t('entryDescription')}
                  </label>
                  <Input
                    id={`me-desc-${entryId}`}
                    className="mt-1"
                    maxLength={200}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={pending}
                  onClick={handleDelete}
                >
                  {t('deleteManualEntry')}
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    {t('cancelEntry')}
                  </Button>
                  <Button type="submit" disabled={pending}>
                    {pending ? t('saving') : t('saveManualEntryChanges')}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
