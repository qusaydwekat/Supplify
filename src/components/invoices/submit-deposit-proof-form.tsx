'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { submitDepositProof } from '@/lib/actions/deposit-proofs'
import type { SupplierBankAccountPublic } from '@/lib/data/supplier-bank-accounts'
import { SupplierBankAccountsList } from '@/components/invoices/supplier-bank-accounts-list'

type Props = {
  invoiceId: string
  invoiceCurrency: string
  remaining: number
  supplierBankAccounts: SupplierBankAccountPublic[]
  /** When false, bank directory is omitted (parent may render it separately). Default true. */
  showBankDirectory?: boolean
}

export function SubmitDepositProofForm({
  invoiceId,
  invoiceCurrency,
  remaining,
  supplierBankAccounts,
  showBankDirectory = true,
}: Props) {
  const t = useTranslations('DepositProofForm')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [form, setForm] = useState({
    amount: String(remaining),
    bankName: supplierBankAccounts[0]?.bank_name ?? '',
    branch: supplierBankAccounts[0]?.branch ?? '',
    referenceNote: '',
    depositDate: new Date().toISOString().slice(0, 10),
  })

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const amt = Number(form.amount)
      if (!Number.isFinite(amt) || amt <= 0) {
        toast.error(t('amountRequired'))
        return
      }
      const res = await submitDepositProof({
        invoiceId,
        amount: amt,
        paymentCurrency: invoiceCurrency,
        bankName: form.bankName,
        branch: form.branch,
        referenceNote: form.referenceNote,
        depositDate: form.depositDate,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(t('submittedToast'))
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{t('title')}</h3>
          <p className="mt-1 text-xs text-slate-600">{t('hint')}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="min-h-8 px-3 py-1 text-xs"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? t('cancel') : t('startSubmit')}
        </Button>
      </div>

      {showBankDirectory ? (
        <div className="mt-3">
          <SupplierBankAccountsList accounts={supplierBankAccounts} />
        </div>
      ) : null}

      {open ? (
        <form onSubmit={onSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="form-label">{t('amount', { code: invoiceCurrency })}</label>
            <Input
              className="mt-1.5"
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="form-label">{t('depositDate')}</label>
            <Input
              className="mt-1.5"
              type="date"
              value={form.depositDate}
              onChange={(e) => setForm({ ...form, depositDate: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">{t('bankName')}</label>
            <Input
              className="mt-1.5"
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="form-label">{t('branch')}</label>
            <Input
              className="mt-1.5"
              value={form.branch ?? ''}
              onChange={(e) => setForm({ ...form, branch: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="form-label">{t('referenceNote')}</label>
            <Input
              className="mt-1.5"
              value={form.referenceNote}
              onChange={(e) => setForm({ ...form, referenceNote: e.target.value })}
              placeholder={t('referencePlaceholder')}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? t('submitting') : t('submit')}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
