'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Controller, useForm, type Resolver, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { PalestineBankPicker, PalestineBranchPicker } from '@/components/invoices/record-payment-form'
import { SearchableSelect, type SearchableOption } from '@/components/invoices/searchable-select'
import {
  buildConversionStateFromRates,
  convertBetween,
  currencyDisplayLabel,
  roundMoney2,
  SUPPORTED_SUPPLIER_CURRENCIES,
} from '@/lib/currency'
import { deletePayment, updatePayment } from '@/lib/actions/payments'
import type { PaymentRow } from '@/lib/invoices-types'
import { updatePaymentSchema, type UpdatePaymentInput } from '@/lib/validations/payment'
import { formatCurrency } from '@/lib/utils'
import { fifoInstallmentSlices } from '@/lib/payments/fifo-installment-allocation'
import type { InstallmentPreviewRow } from '@/components/invoices/record-payment-form'

function normalizeMethod(m: string): UpdatePaymentInput['method'] {
  if (m === 'cash' || m === 'bank' || m === 'cheque' || m === 'other') return m
  return 'bank'
}

function defaultsFromPayment(p: PaymentRow, branches: PalestineBranchPicker[]): UpdatePaymentInput {
  let chequeBankId = ''
  let chequeBranchId = ''
  if (p.cheque_bank_branch_id) {
    const br = branches.find((b) => b.id === p.cheque_bank_branch_id)
    if (br) {
      chequeBankId = br.bankId
      chequeBranchId = br.id
    }
  }
  const rawDate = p.cheque_date?.trim() ?? ''
  const chequeDate =
    rawDate.length >= 10 ? rawDate.slice(0, 10) : rawDate

  return {
    paymentId: p.id,
    amount: p.payment_amount,
    paymentCurrency: p.payment_currency.toUpperCase(),
    method: normalizeMethod(p.method),
    referenceNote: p.reference_note ?? '',
    chequeNumber: p.cheque_number ?? '',
    chequeBankId,
    chequeBranchId,
    chequeDate,
    withholdingAmount: Number(p.withholding_amount ?? 0),
    withholdingReference: p.withholding_reference ?? '',
  }
}

type Props = {
  payment: PaymentRow
  invoiceCurrency: string
  /** Invoice-currency ceiling for this payment: remaining balance + this payment's applied amount */
  maxAppliedInvoiceCurrency: number
  defaultAppCurrency: string
  ratesToDefault: Record<string, number>
  banks: PalestineBankPicker[]
  branches: PalestineBranchPicker[]
  /** Schedule + per-installment paid totals from the invoice — for FIFO preview. */
  installmentsPreview?: InstallmentPreviewRow[]
  /** Amount this payment is currently allocated per installment (so we can subtract it before the new preview). */
  currentAllocations?: { installment_id: string; amount: number }[]
}

export function EditPaymentDialog({
  payment,
  invoiceCurrency,
  maxAppliedInvoiceCurrency,
  defaultAppCurrency,
  ratesToDefault,
  banks,
  branches,
  installmentsPreview,
  currentAllocations,
}: Props) {
  const t = useTranslations('RecordPaymentForm')
  const tEdit = useTranslations('EditPaymentForm')
  const tPay = useTranslations('PaymentMethods')
  const locale = useLocale()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  const conversionState = useMemo(
    () => buildConversionStateFromRates(defaultAppCurrency, ratesToDefault),
    [defaultAppCurrency, ratesToDefault],
  )

  const currencyOptions = useMemo(() => {
    const keys = new Set<string>()
    for (const c of SUPPORTED_SUPPLIER_CURRENCIES) {
      if (conversionState.toDefault.has(c)) keys.add(c)
    }
    return [...keys].sort()
  }, [conversionState])

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<UpdatePaymentInput>({
    resolver: zodResolver(updatePaymentSchema) as Resolver<UpdatePaymentInput>,
    defaultValues: defaultsFromPayment(payment, branches),
  })

  useEffect(() => {
    if (!open) return
    reset(defaultsFromPayment(payment, branches))
  }, [open, payment, branches, reset])

  const paymentCurrency =
    useWatch({ control, name: 'paymentCurrency', defaultValue: payment.payment_currency }) ??
    payment.payment_currency
  const amountVal = useWatch({ control, name: 'amount', defaultValue: payment.payment_amount })
  const method = useWatch({ control, name: 'method', defaultValue: normalizeMethod(payment.method) }) ?? 'bank'
  const chequeBankId = useWatch({ control, name: 'chequeBankId', defaultValue: '' }) ?? ''

  const maxInPaymentCurrency = useMemo(() => {
    try {
      return roundMoney2(
        convertBetween(maxAppliedInvoiceCurrency, invoiceCurrency, paymentCurrency, conversionState),
      )
    } catch {
      return maxAppliedInvoiceCurrency
    }
  }, [maxAppliedInvoiceCurrency, invoiceCurrency, paymentCurrency, conversionState])

  const appliedPreview = useMemo(() => {
    const raw = typeof amountVal === 'number' ? amountVal : Number(amountVal)
    if (!Number.isFinite(raw) || raw <= 0) return null
    try {
      return roundMoney2(convertBetween(raw, paymentCurrency, invoiceCurrency, conversionState))
    } catch {
      return null
    }
  }, [amountVal, paymentCurrency, invoiceCurrency, conversionState])

  const defaultPreview = useMemo(() => {
    const raw = typeof amountVal === 'number' ? amountVal : Number(amountVal)
    if (!Number.isFinite(raw) || raw <= 0) return null
    const m = conversionState.toDefault.get(paymentCurrency.toUpperCase())
    if (m == null) return null
    return roundMoney2(raw * m)
  }, [amountVal, paymentCurrency, conversionState])

  const dueByInstallmentId = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of installmentsPreview ?? []) m.set(i.id, i.due_date)
    return m
  }, [installmentsPreview])

  const installmentAllocPreview = useMemo(() => {
    if (!installmentsPreview?.length || appliedPreview == null || appliedPreview <= 0) return null
    const stubs = [...installmentsPreview]
      .sort((a, b) => a.seq - b.seq)
      .map((i) => ({ id: i.id, seq: i.seq, amount_due: i.amount_due }))
    const paidCopy = new Map<string, number>()
    for (const i of installmentsPreview) {
      paidCopy.set(i.id, roundMoney2(i.paid_toward))
    }
    for (const a of currentAllocations ?? []) {
      const id = a.installment_id
      const cur = paidCopy.get(id) ?? 0
      paidCopy.set(id, roundMoney2(Math.max(0, cur - Number(a.amount))))
    }
    return fifoInstallmentSlices(stubs, paidCopy, appliedPreview)
  }, [installmentsPreview, appliedPreview, currentAllocations])

  const fmtDue = (iso: string) => {
    const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
    if (Number.isNaN(d.getTime())) return iso
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', { calendar: 'gregory', dateStyle: 'short' }).format(d)
  }

  useEffect(() => {
    if (method !== 'cheque') {
      setValue('chequeBankId', '')
      setValue('chequeBranchId', '')
    }
  }, [method, setValue])

  const bankOptions: SearchableOption[] = useMemo(
    () =>
      banks.map((b) => ({
        value: b.id,
        label: locale === 'ar' && b.nameAr?.trim() ? b.nameAr.trim() : b.nameEn,
      })),
    [banks, locale],
  )

  const branchOptions: SearchableOption[] = useMemo(() => {
    const bid = chequeBankId.trim()
    if (!bid) return []
    return branches
      .filter((br) => br.bankId === bid)
      .map((br) => ({
        value: br.id,
        label:
          `#${br.branchNumber} ${locale === 'ar' && br.nameAr?.trim() ? br.nameAr.trim() : br.nameEn}${br.city ? ` — ${br.city}` : ''}`,
        sublabel: br.phone ?? undefined,
      }))
  }, [branches, chequeBankId, locale])

  function onSubmit(values: UpdatePaymentInput) {
    start(async () => {
      const r = await updatePayment(values)
      if (r.error) toast.error(r.error)
      else {
        toast.success(tEdit('success'))
        setOpen(false)
        router.refresh()
      }
    })
  }

  function handleDelete() {
    if (!window.confirm(tEdit('deleteConfirm'))) return
    start(async () => {
      const r = await deletePayment({ paymentId: payment.id })
      if (r.error) toast.error(r.error)
      else {
        toast.success(tEdit('deleteSuccess'))
        setOpen(false)
        router.refresh()
      }
    })
  }

  function chequeFieldError(name: 'chequeNumber' | 'chequeDate' | 'chequeBankId' | 'chequeBranchId') {
    const e = errors[name]
    if (!e?.message) return null
    if (name === 'chequeDate' && String(e.message).toLowerCase().includes('valid')) {
      return t('errors.chequeDateInvalid')
    }
    if (name === 'chequeBankId') return t('errors.chequeBankId')
    if (name === 'chequeBranchId') return t('errors.chequeBranchId')
    return t(`errors.${name}`)
  }

  return (
    <>
      <Button type="button" variant="secondary" className="shrink-0 px-3 py-1.5 text-xs" onClick={() => setOpen(true)}>
        {tEdit('open')}
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-payment-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 id="edit-payment-title" className="text-sm font-semibold text-slate-900">
                {tEdit('title')}
              </h2>
              <p className="mt-1 text-xs text-slate-600">{tEdit('lead')}</p>
            </div>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                <p className="text-xs text-slate-600">
                  {tEdit('ceilingHint')}{' '}
                  <span className="font-medium text-slate-900">
                    {formatCurrency(maxAppliedInvoiceCurrency, invoiceCurrency)}
                  </span>
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-xs text-slate-600">
                    {t('paymentCurrency')}
                    <select
                      className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      {...register('paymentCurrency')}
                    >
                      {currencyOptions.map((c) => (
                        <option key={c} value={c}>
                          {currencyDisplayLabel(c)}
                        </option>
                      ))}
                    </select>
                    {errors.paymentCurrency ? (
                      <span className="text-red-600">{errors.paymentCurrency.message}</span>
                    ) : null}
                  </label>
                  <label className="text-xs text-slate-600">
                    {t('amount')}
                    <input
                      type="number"
                      step="0.01"
                      min={0.01}
                      max={maxInPaymentCurrency}
                      className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      {...register('amount')}
                    />
                    {errors.amount ? <span className="text-red-600">{errors.amount.message}</span> : null}
                  </label>
                  <label className="text-xs text-slate-600 sm:col-span-2">
                    {t('method')}
                    <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" {...register('method')}>
                      <option value="cash">{tPay('cash')}</option>
                      <option value="bank">{tPay('bank')}</option>
                      <option value="cheque">{tPay('cheque')}</option>
                      <option value="other">{tPay('other')}</option>
                    </select>
                  </label>
                </div>
                {method === 'cheque' ? (
                  <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/40 p-3 sm:p-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-violet-900">{t('chequeDetailsTitle')}</p>
                      <p className="text-xs text-violet-800/90">{t('chequeDirectoryHint')}</p>
                    </div>
                    {banks.length === 0 ? (
                      <p className="text-sm text-amber-800">{t('banksDirectoryEmpty')}</p>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs text-slate-600">
                        {t('chequeNumber')}
                        <input
                          type="text"
                          autoComplete="off"
                          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                          {...register('chequeNumber')}
                        />
                        {chequeFieldError('chequeNumber') ? (
                          <span className="text-red-600">{chequeFieldError('chequeNumber')}</span>
                        ) : null}
                      </label>
                      <label className="text-xs text-slate-600">
                        {t('chequeDate')}
                        <input
                          type="date"
                          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                          {...register('chequeDate')}
                        />
                        {chequeFieldError('chequeDate') ? (
                          <span className="text-red-600">{chequeFieldError('chequeDate')}</span>
                        ) : null}
                      </label>
                      <div className="text-xs text-slate-600 sm:col-span-2">
                        <span className="block">{t('chequeBankSelect')}</span>
                        <Controller
                          name="chequeBankId"
                          control={control}
                          render={({ field }) => (
                            <SearchableSelect
                              className="mt-1"
                              value={field.value ?? ''}
                              onChange={(v) => {
                                field.onChange(v)
                                setValue('chequeBranchId', '')
                              }}
                              options={bankOptions}
                              placeholder={t('chequeBankPlaceholder')}
                              searchPlaceholder={t('searchPlaceholder')}
                              emptyText={t('searchEmpty')}
                              disabled={banks.length === 0}
                              aria-invalid={!!errors.chequeBankId}
                            />
                          )}
                        />
                        {chequeFieldError('chequeBankId') ? (
                          <span className="text-red-600">{chequeFieldError('chequeBankId')}</span>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-600 sm:col-span-2">
                        <span className="block">{t('chequeBranchSelect')}</span>
                        <Controller
                          name="chequeBranchId"
                          control={control}
                          render={({ field }) => (
                            <SearchableSelect
                              className="mt-1"
                              value={field.value ?? ''}
                              onChange={field.onChange}
                              options={branchOptions}
                              placeholder={t('chequeBranchPlaceholder')}
                              searchPlaceholder={t('searchPlaceholder')}
                              emptyText={t('searchEmptyBranch')}
                              disabled={!chequeBankId.trim() || branchOptions.length === 0}
                              aria-invalid={!!errors.chequeBranchId}
                            />
                          )}
                        />
                        {chequeFieldError('chequeBranchId') ? (
                          <span className="text-red-600">{chequeFieldError('chequeBranchId')}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
                {appliedPreview != null && paymentCurrency !== invoiceCurrency ? (
                  <p className="text-xs text-slate-600">
                    {t('appliedToInvoice')}:{' '}
                    <span className="font-medium text-slate-900">
                      {formatCurrency(appliedPreview, invoiceCurrency)}
                    </span>
                  </p>
                ) : null}
                {defaultPreview != null && paymentCurrency !== defaultAppCurrency ? (
                  <p className="text-xs text-slate-600">
                    {t('inDefaultCurrency', { code: defaultAppCurrency })}:{' '}
                    <span className="font-medium text-slate-900">{formatCurrency(defaultPreview, defaultAppCurrency)}</span>
                  </p>
                ) : null}
                {installmentAllocPreview && installmentAllocPreview.slices.length > 0 ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50/90 p-3 text-xs">
                    <p className="font-semibold text-slate-800">{t('installmentPreviewTitle')}</p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-slate-700">
                      {installmentAllocPreview.slices.map((s) => {
                        const dueRaw = dueByInstallmentId.get(s.installment_id) ?? ''
                        const dueLabel = dueRaw ? fmtDue(dueRaw) : '—'
                        const instSeq = installmentsPreview?.find((x) => x.id === s.installment_id)?.seq ?? '—'
                        return (
                          <li key={s.installment_id}>
                            {t('installmentPreviewLine', {
                              seq: instSeq,
                              due: dueLabel,
                              amount: formatCurrency(s.amount, invoiceCurrency),
                            })}
                          </li>
                        )
                      })}
                    </ul>
                    {installmentAllocPreview.leftover > 0.02 ? (
                      <p className="mt-2 text-amber-900">
                        {t('installmentPreviewLeftover', {
                          amount: formatCurrency(installmentAllocPreview.leftover, invoiceCurrency),
                        })}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <label className="block text-xs text-slate-600">
                  {t('referenceNote')}
                  {method === 'cheque' ? (
                    <span className="mt-0.5 block font-normal text-slate-500">{t('referenceNoteChequeHint')}</span>
                  ) : null}
                  <input
                    type="text"
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    {...register('referenceNote')}
                  />
                </label>
                <details className="rounded-md border border-slate-200 bg-slate-50/40 p-3 text-xs text-slate-600">
                  <summary className="cursor-pointer font-medium text-slate-800">{t('withholdingTitle')}</summary>
                  <p className="mt-2 text-[11px] text-slate-500">{t('withholdingHint')}</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="block">
                      {t('withholdingAmount', { code: invoiceCurrency })}
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        {...register('withholdingAmount', { valueAsNumber: true })}
                      />
                    </label>
                    <label className="block">
                      {t('withholdingReference')}
                      <input
                        type="text"
                        className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        {...register('withholdingReference')}
                      />
                    </label>
                  </div>
                </details>
                <input type="hidden" {...register('paymentId')} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={pending}
                  onClick={handleDelete}
                >
                  {tEdit('delete')}
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    {tEdit('cancel')}
                  </Button>
                  <Button type="submit" disabled={pending}>
                    {tEdit('save')}
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
