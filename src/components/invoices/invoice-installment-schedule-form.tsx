'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { saveInvoiceInstallmentSchedule } from '@/lib/actions/installments'
import type { InstallmentRow } from '@/lib/invoices-types'
import { formatMoney } from '@/lib/format-money'

export type InstallmentFormRow = { dueDate: string; amountDue: number }

type Props = {
  invoiceId: string
  invoiceTotal: number
  currencyCode: string
  defaultDueDate: string | null
  initialInstallments: InstallmentRow[]
}

function isoToDateInput(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function buildRows(invoiceTotal: number, defaultDueDate: string | null, initialInstallments: InstallmentRow[]): InstallmentFormRow[] {
  if (initialInstallments.length) {
    return initialInstallments.map((r) => ({
      dueDate: isoToDateInput(r.due_date),
      amountDue: r.amount_due,
    }))
  }
  const fallbackDate =
    isoToDateInput(defaultDueDate) || new Date().toISOString().slice(0, 10)
  return [{ dueDate: fallbackDate, amountDue: invoiceTotal }]
}

export function InvoiceInstallmentScheduleForm({
  invoiceId,
  invoiceTotal,
  currencyCode,
  defaultDueDate,
  initialInstallments,
}: Props) {
  const t = useTranslations('InvoiceInstallments')
  const [pending, start] = useTransition()

  const seed = useMemo(
    () => buildRows(invoiceTotal, defaultDueDate, initialInstallments),
    [invoiceTotal, defaultDueDate, initialInstallments],
  )

  const [rows, setRows] = useState<InstallmentFormRow[]>(seed)

  useEffect(() => {
    setRows(seed)
  }, [seed])

  function submit() {
    const cleaned = rows.filter((r) => r.dueDate.trim() && Number.isFinite(r.amountDue) && r.amountDue > 0)
    if (!cleaned.length) {
      toast.error(t('needOneRow'))
      return
    }
    start(async () => {
      const r = await saveInvoiceInstallmentSchedule({ invoiceId, rows: cleaned })
      if (!r.ok) {
        const msg = r.errorKey
          ? (t as (key: string, values?: Record<string, string | number>) => string)(
              r.errorKey,
              r.errorParams && Object.keys(r.errorParams).length ? r.errorParams : undefined,
            )
          : r.error
        toast.error(msg)
      } else toast.success(t('saved'))
    })
  }

  const sumDue = useMemo(
    () => Math.round(rows.reduce((s, r) => s + (Number.isFinite(r.amountDue) ? r.amountDue : 0), 0) * 100) / 100,
    [rows],
  )
  const delta = Math.round((sumDue - invoiceTotal) * 100) / 100

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{t('title')}</h3>
        <p className="mt-1 text-xs text-slate-600">{t('hint')}</p>
        <p className="mt-1 text-xs text-amber-800">{t('beforePaymentsOnly')}</p>
      </div>

      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-xs text-slate-600">
              {t('dueDate')}
              <input
                type="date"
                value={row.dueDate}
                onChange={(e) => {
                  const v = e.target.value
                  setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, dueDate: v } : x)))
                }}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              {t('amount')}
              <input
                type="number"
                step="0.01"
                min={0.01}
                value={Number.isFinite(row.amountDue) ? row.amountDue : ''}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, amountDue: v } : x)))
                }}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <Button
              type="button"
              variant="ghost"
              className="shrink-0"
              disabled={rows.length <= 1}
              onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
            >
              {t('remove')}
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={() =>
          setRows((prev) => [
            ...prev,
            {
              dueDate: isoToDateInput(defaultDueDate) || new Date().toISOString().slice(0, 10),
              amountDue: Math.max(0.01, round2(invoiceTotal - sumDue)),
            },
          ])
        }
      >
        {t('addRow')}
      </Button>

      <p className="text-xs text-slate-500">
        {t('totalInvoice')}: <span className="font-medium text-slate-900">{formatMoney(invoiceTotal, currencyCode)}</span>
        {' · '}
        {t('sumScheduled')}:{' '}
        <span className={`font-medium ${Math.abs(delta) > 0.02 ? 'text-red-700' : 'text-slate-900'}`}>
          {formatMoney(sumDue, currencyCode)}
        </span>
        {Math.abs(delta) > 0.02 ? (
          <span className="ml-2 text-red-600">
            ({delta > 0 ? '+' : ''}
            {delta.toFixed(2)})
          </span>
        ) : null}
      </p>

      <Button type="button" disabled={pending || Math.abs(delta) > 0.02} onClick={() => submit()}>
        {t('save')}
      </Button>
    </div>
  )
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
