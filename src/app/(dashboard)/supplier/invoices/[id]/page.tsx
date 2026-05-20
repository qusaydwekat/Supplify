import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { InvoiceInstallmentScheduleForm } from '@/components/invoices/invoice-installment-schedule-form'
import { InvoiceInstallmentsTable } from '@/components/invoices/invoice-installments-table'
import { InvoiceLineItems } from '@/components/invoices/invoice-line-items'
import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge'
import { InvoicePaymentsList } from '@/components/invoices/invoice-payments-list'
import { RecordPaymentForm } from '@/components/invoices/record-payment-form'
import { InvoicePdfDownloadButton } from '@/components/invoices/invoice-pdf-download-button'
import { WhatsAppShareButton } from '@/components/share/whatsapp-share-button'
import { loadCurrencyConversionState } from '@/lib/currency'
import { formatDateMedium, formatDateTimeShort, normalizeAppLocale } from '@/lib/format-datetime'
import { formatMoney } from '@/lib/format-money'
import { getSupplierInvoiceDetail } from '@/lib/data/invoices'
import { listPalestineBanksAndBranches } from '@/lib/data/palestine-banks'
import { supabaseServer } from '@/lib/supabase/server'

export default async function SupplierInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations('InvoiceDetailPage')
  const tInst = await getTranslations('InvoiceInstallments')
  const tCommon = await getTranslations('Common')
  const locale = normalizeAppLocale(await getLocale())
  const { id } = await params
  const res = await getSupplierInvoiceDetail(id)

  if ('error' in res) {
    if (res.error === 'Invoice not found' || res.error === 'Forbidden') notFound()
    return <p className="text-sm text-red-600">{tCommon('loadErrorDetails', { details: res.error })}</p>
  }

  const { invoice: inv } = res
  const supabase = supabaseServer()
  const conv = await loadCurrencyConversionState(supabase)
  const defaultAppCurrency = 'error' in conv ? 'USD' : conv.defaultCurrency
  const ratesToDefault: Record<string, number> = {}
  if (!('error' in conv)) {
    conv.toDefault.forEach((v, k) => {
      ratesToDefault[k] = v
    })
  }

  const fmtDT = (d: string) => formatDateTimeShort(d, locale)
  const fmtD = (d: string | null) => formatDateMedium(d, locale)

  const bankDir = await listPalestineBanksAndBranches()
  const banksPicker =
    'error' in bankDir
      ? []
      : bankDir.banks.map((b) => ({
          id: b.id,
          nameEn: b.name_en,
          nameAr: b.name_ar,
        }))
  const branchesPicker =
    'error' in bankDir
      ? []
      : bankDir.branches.map((br) => ({
          id: br.id,
          bankId: br.bank_id,
          branchNumber: br.branch_number,
          nameEn: br.name_en,
          nameAr: br.name_ar,
          city: br.city,
          phone: br.phone,
        }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/supplier/invoices" className="text-sm text-slate-600 hover:text-slate-900 hover:underline">
            â† {t('backInvoices')}
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">{inv.invoice_number}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('billTo', { name: inv.counterparty })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InvoiceStatusBadge status={inv.status} dueDate={inv.due_date} />
          <InvoicePdfDownloadButton
            invoiceId={inv.id}
            invoiceNumber={inv.invoice_number}
            className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
          >
            {t('downloadPdf')}
          </InvoicePdfDownloadButton>
          <WhatsAppShareButton
            message={t('whatsappShareMessage', {
              invoice: inv.invoice_number,
              total: formatMoney(inv.total, inv.currency_code),
              counterparty: inv.counterparty,
            })}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 text-sm">
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
          <p className="text-xs font-medium uppercase text-slate-500">{t('issued')}</p>
          <p className="mt-1 text-slate-900">{fmtDT(inv.issued_at)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
          <p className="text-xs font-medium uppercase text-slate-500">{t('due')}</p>
          <p className="mt-1 text-slate-900">{fmtD(inv.due_date)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href={`/supplier/orders/${inv.order_id}`} className="text-slate-900 underline-offset-2 hover:underline">
          {t('viewOrder')}
        </Link>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">{t('lineItems')}</h2>
        <InvoiceLineItems items={inv.items} currencyCode={inv.currency_code} />
        <div className="flex flex-wrap justify-end gap-6 border-t border-slate-200 pt-3 text-sm">
          <span className="text-slate-600">{t('invoiceTotal')}</span>
          <span className="font-semibold text-slate-900">{formatMoney(inv.total, inv.currency_code)}</span>
        </div>
        <div className="flex flex-wrap justify-end gap-6 text-sm">
          <span className="text-slate-600">{t('paid')}</span>
          <span className="font-medium text-slate-900">{formatMoney(inv.paidTotal, inv.currency_code)}</span>
        </div>
        <div className="flex flex-wrap justify-end gap-6 text-sm">
          <span className="text-slate-600">{t('remaining')}</span>
          <span className="font-semibold text-slate-900">{formatMoney(inv.remaining, inv.currency_code)}</span>
        </div>
      </section>

      <InvoiceInstallmentsTable
        installments={inv.installments}
        currencyCode={inv.currency_code}
        locale={locale}
        labels={{
          title: tInst('tableTitle'),
          colDue: tInst('colDue'),
          colScheduled: tInst('colScheduled'),
          colPaid: tInst('colPaid'),
          colRemaining: tInst('colRemaining'),
        }}
      />

      {inv.canEditInstallmentSchedule ? (
        <InvoiceInstallmentScheduleForm
          key={`inst-${inv.installments.map((i) => i.id).join('-')}-${inv.paidTotal}`}
          invoiceId={inv.id}
          invoiceTotal={inv.total}
          currencyCode={inv.currency_code}
          defaultDueDate={inv.due_date}
          initialInstallments={inv.installments}
        />
      ) : null}

      {inv.notes ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">{t('notes')}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{inv.notes}</p>
        </section>
      ) : null}

      {inv.payments.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">{t('payments')}</h2>
          <InvoicePaymentsList
            payments={inv.payments}
            invoiceCurrency={inv.currency_code}
            defaultAppCurrency={defaultAppCurrency}
            remaining={inv.remaining}
            ratesToDefault={ratesToDefault}
            showActions
            banks={banksPicker}
            branches={branchesPicker}
            installmentsPreview={inv.installments}
            paymentAllocations={inv.paymentAllocations}
          />
        </section>
      ) : null}

      <RecordPaymentForm
        key={`${inv.remaining}-${inv.currency_code}`}
        invoiceId={inv.id}
        remaining={inv.remaining}
        invoiceCurrency={inv.currency_code}
        defaultAppCurrency={defaultAppCurrency}
        ratesToDefault={ratesToDefault}
        banks={banksPicker}
        branches={branchesPicker}
        installmentsPreview={inv.installments}
        invoiceDueDate={inv.due_date}
      />
    </div>
  )
}
