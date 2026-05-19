'use client'

import { useLocale, useTranslations } from 'next-intl'
import { ChequeActions, ChequeStatusRetailerRow } from '@/components/invoices/cheque-actions'
import { EditPaymentDialog } from '@/components/invoices/edit-payment-dialog'
import type {
  InstallmentPreviewRow,
  PalestineBankPicker,
  PalestineBranchPicker,
} from '@/components/invoices/record-payment-form'
import { formatDateMedium, formatDateTimeShort, normalizeAppLocale } from '@/lib/format-datetime'
import { formatPaymentReferenceParts } from '@/lib/format-payment-reference'
import { formatMoney } from '@/lib/format-money'
import type { PaymentRow } from '@/lib/invoices-types'

type Props = {
  payments: PaymentRow[]
  invoiceCurrency: string
  defaultAppCurrency: string
  remaining: number
  ratesToDefault: Record<string, number>
  /** Supplier invoice: edit, cheque workflow, withholding. Retailer: read-only list. */
  showActions?: boolean
  banks?: PalestineBankPicker[]
  branches?: PalestineBranchPicker[]
  installmentsPreview?: InstallmentPreviewRow[]
  paymentAllocations?: Record<string, { installment_id: string; amount: number }[]>
}

function paymentMethodKey(m: string): 'cash' | 'bank' | 'cheque' | 'other' | null {
  if (m === 'cash' || m === 'bank' || m === 'cheque' || m === 'other') return m
  return null
}

function PaymentAmountBlock({
  payment,
  invoiceCurrency,
  defaultAppCurrency,
  inDefaultPrefix,
}: {
  payment: PaymentRow
  invoiceCurrency: string
  defaultAppCurrency: string
  inDefaultPrefix: string
}) {
  return (
    <div className="text-end font-medium tabular-nums sm:text-start">
      <div className="text-sm text-slate-900">{formatMoney(payment.amount, invoiceCurrency)}</div>
      {payment.payment_currency !== invoiceCurrency ? (
        <div className="text-xs font-normal text-slate-500">
          {formatMoney(payment.payment_amount, payment.payment_currency)}
        </div>
      ) : null}
      {payment.payment_currency !== defaultAppCurrency ? (
        <div className="text-xs font-normal text-slate-500">
          {inDefaultPrefix}: {formatMoney(payment.amount_in_default_currency, defaultAppCurrency)}
        </div>
      ) : null}
    </div>
  )
}

function PaymentReferenceBlock({
  payment,
  locale,
  chequeMetaLine,
}: {
  payment: PaymentRow
  locale: ReturnType<typeof normalizeAppLocale>
  chequeMetaLine: (v: { number: string; bank: string; branch: string; date: string }) => string
}) {
  const parts = formatPaymentReferenceParts(
    payment,
    (iso) => formatDateMedium(iso, locale),
    chequeMetaLine,
  )
  return (
    <div className="min-w-0 space-y-0.5">
      <div className="whitespace-pre-wrap break-words text-sm text-slate-700">{parts.primary}</div>
      {parts.note ? <div className="text-xs text-slate-500">{parts.note}</div> : null}
    </div>
  )
}

function PaymentSupplierActions({
  payment,
  invoiceCurrency,
  defaultAppCurrency,
  remaining,
  ratesToDefault,
  banks,
  branches,
  installmentsPreview,
  currentAllocations,
}: {
  payment: PaymentRow
  invoiceCurrency: string
  defaultAppCurrency: string
  remaining: number
  ratesToDefault: Record<string, number>
  banks: PalestineBankPicker[]
  branches: PalestineBranchPicker[]
  installmentsPreview?: InstallmentPreviewRow[]
  currentAllocations: { installment_id: string; amount: number }[]
}) {
  const t = useTranslations('InvoiceDetailPage')
  const maxAppliedInvoiceCurrency = Math.round((remaining + payment.amount) * 100) / 100

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 md:border-0 md:pt-0">
      <EditPaymentDialog
        payment={payment}
        invoiceCurrency={invoiceCurrency}
        maxAppliedInvoiceCurrency={maxAppliedInvoiceCurrency}
        defaultAppCurrency={defaultAppCurrency}
        ratesToDefault={ratesToDefault}
        banks={banks}
        branches={branches}
        installmentsPreview={installmentsPreview}
        currentAllocations={currentAllocations}
      />
      {payment.method === 'cheque' ? (
        <ChequeActions
          paymentId={payment.id}
          chequeStatus={payment.cheque_status}
          chequeDate={payment.cheque_date}
        />
      ) : null}
      {payment.withholding_amount > 0 ? (
        <div className="rounded-md bg-violet-50 px-2 py-1.5 text-xs text-violet-800 dark:bg-violet-950/30 dark:text-violet-200">
          <span className="font-medium">{t('withholdingApplied')}: </span>
          {formatMoney(payment.withholding_amount, invoiceCurrency)}
          {payment.withholding_reference ? ` (${payment.withholding_reference})` : ''}
        </div>
      ) : null}
    </div>
  )
}

export function InvoicePaymentsList({
  payments,
  invoiceCurrency,
  defaultAppCurrency,
  remaining,
  ratesToDefault,
  showActions = false,
  banks = [],
  branches = [],
  installmentsPreview,
  paymentAllocations = {},
}: Props) {
  const t = useTranslations('InvoiceDetailPage')
  const tPay = useTranslations('PaymentMethods')
  const locale = normalizeAppLocale(useLocale())
  const fmtDT = (d: string) => formatDateTimeShort(d, locale)

  const methodLabel = (m: string) => {
    const key = paymentMethodKey(m)
    return key ? tPay(key) : m
  }

  if (!payments.length) return null

  return (
    <div className="rounded-lg border border-slate-200">
      <ul className="divide-y divide-slate-100 md:hidden">
        {payments.map((p) => (
          <li key={p.id} className="p-4">
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('colDate')}</dt>
                <dd className="mt-0.5 text-slate-700">{fmtDT(p.created_at)}</dd>
              </div>
              <div className="text-end">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('colMethod')}</dt>
                <dd className="mt-0.5 capitalize text-slate-800">{methodLabel(p.method)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('colAmount')}</dt>
                <dd className="mt-1">
                  <PaymentAmountBlock
                    payment={p}
                    invoiceCurrency={invoiceCurrency}
                    defaultAppCurrency={defaultAppCurrency}
                    inDefaultPrefix={t('inDefault', { code: defaultAppCurrency })}
                  />
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('colReference')}</dt>
                <dd className="mt-1">
                  <PaymentReferenceBlock
                    payment={p}
                    locale={locale}
                    chequeMetaLine={(v) => t('chequeMetaLine', v)}
                  />
                  {!showActions && p.method === 'cheque' ? (
                    <div className="mt-2">
                      <ChequeStatusRetailerRow payment={p} />
                    </div>
                  ) : null}
                </dd>
              </div>
            </dl>
            {showActions ? (
              <PaymentSupplierActions
                payment={p}
                invoiceCurrency={invoiceCurrency}
                defaultAppCurrency={defaultAppCurrency}
                remaining={remaining}
                ratesToDefault={ratesToDefault}
                banks={banks}
                branches={branches}
                installmentsPreview={installmentsPreview}
                currentAllocations={paymentAllocations[p.id] ?? []}
              />
            ) : null}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-start text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">{t('colDate')}</th>
              <th className="px-4 py-2">{t('colMethod')}</th>
              <th className="px-4 py-2 text-end">{t('colAmount')}</th>
              <th className="px-4 py-2">{t('colReference')}</th>
              {showActions ? <th className="w-[1%] whitespace-nowrap px-4 py-2">{t('colActions')}</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">{fmtDT(p.created_at)}</td>
                <td className="px-4 py-2">{methodLabel(p.method)}</td>
                <td className="px-4 py-2 text-end font-medium">
                  <PaymentAmountBlock
                    payment={p}
                    invoiceCurrency={invoiceCurrency}
                    defaultAppCurrency={defaultAppCurrency}
                    inDefaultPrefix={t('inDefault', { code: defaultAppCurrency })}
                  />
                </td>
                <td className="px-4 py-2 text-slate-600">
                  <PaymentReferenceBlock
                    payment={p}
                    locale={locale}
                    chequeMetaLine={(v) => t('chequeMetaLine', v)}
                  />
                  {!showActions && p.method === 'cheque' ? (
                    <div className="mt-2 max-w-md">
                      <ChequeStatusRetailerRow payment={p} />
                    </div>
                  ) : null}
                </td>
                {showActions ? (
                  <td className="px-4 py-2 align-top">
                    <PaymentSupplierActions
                      payment={p}
                      invoiceCurrency={invoiceCurrency}
                      defaultAppCurrency={defaultAppCurrency}
                      remaining={remaining}
                      ratesToDefault={ratesToDefault}
                      banks={banks}
                      branches={branches}
                      installmentsPreview={installmentsPreview}
                      currentAllocations={paymentAllocations[p.id] ?? []}
                    />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
