import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { InvoiceInstallmentsTable } from '@/components/invoices/invoice-installments-table'
import { InvoiceLineItems } from '@/components/invoices/invoice-line-items'
import { InvoicePaymentsList } from '@/components/invoices/invoice-payments-list'
import { RetailerDepositProofsSection } from '@/components/invoices/retailer-deposit-proofs-section'
import { RetailerInvoiceBalanceHero } from '@/components/invoices/retailer-invoice-balance-hero'
import { SubmitDepositProofForm } from '@/components/invoices/submit-deposit-proof-form'
import { SupplierBankAccountsList } from '@/components/invoices/supplier-bank-accounts-list'
import { InvoicePdfDownloadButton } from '@/components/invoices/invoice-pdf-download-button'
import { WhatsAppShareButton } from '@/components/share/whatsapp-share-button'
import { loadCurrencyConversionState } from '@/lib/currency'
import { listDepositProofsForInvoice } from '@/lib/data/deposit-proofs-retailer'
import { getRetailerInvoiceDetail } from '@/lib/data/invoices'
import { listSupplierBankAccounts } from '@/lib/data/supplier-bank-accounts'
import { formatMoney } from '@/lib/format-money'
import { normalizeAppLocale } from '@/lib/format-datetime'
import { supabaseServer } from '@/lib/supabase/server'

export default async function RetailerInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations('InvoiceDetailPage')
  const tInst = await getTranslations('InvoiceInstallments')
  const tCommon = await getTranslations('Common')
  const locale = normalizeAppLocale(await getLocale())
  const { id } = await params
  const res = await getRetailerInvoiceDetail(id)

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

  const [banks, proofsRes] = await Promise.all([
    listSupplierBankAccounts(inv.supplier_id),
    listDepositProofsForInvoice(inv.id),
  ])
  const proofs = 'error' in proofsRes ? [] : proofsRes

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-1 sm:px-0">
      <Link href="/retailer/invoices" className="inline-flex text-sm text-muted-foreground hover:text-foreground hover:underline">
        ← {t('backInvoices')}
      </Link>

      <RetailerInvoiceBalanceHero
        invoiceNumber={inv.invoice_number}
        status={inv.status}
        counterparty={inv.counterparty}
        currencyCode={inv.currency_code}
        total={inv.total}
        paidTotal={inv.paidTotal}
        remaining={inv.remaining}
        dueDate={inv.due_date}
        orderId={inv.order_id}
      />

      <div className="flex flex-wrap gap-2">
        <InvoicePdfDownloadButton
          invoiceId={inv.id}
          invoiceNumber={inv.invoice_number}
          className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted disabled:opacity-60"
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

      <RetailerDepositProofsSection proofs={proofs} />

      {inv.remaining > 0 ? (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t('retailerPayHubTitle')}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t('retailerPayHubSubtitle')}</p>
          </div>
          <SupplierBankAccountsList accounts={banks} />
          <SubmitDepositProofForm
            invoiceId={inv.id}
            invoiceCurrency={inv.currency_code}
            remaining={inv.remaining}
            supplierBankAccounts={banks}
            showBankDirectory={false}
          />
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-foreground">{t('lineItems')}</h2>
        <InvoiceLineItems items={inv.items} currencyCode={inv.currency_code} />
        <div className="flex flex-wrap justify-end gap-6 border-t border-slate-200 pt-3 text-sm dark:border-border">
          <span className="text-slate-600 dark:text-muted-foreground">{t('invoiceTotal')}</span>
          <span className="font-semibold text-slate-900 dark:text-foreground">{formatMoney(inv.total, inv.currency_code)}</span>
        </div>
        <div className="flex flex-wrap justify-end gap-6 text-sm">
          <span className="text-slate-600 dark:text-muted-foreground">{t('paid')}</span>
          <span className="font-medium text-slate-900 dark:text-foreground">{formatMoney(inv.paidTotal, inv.currency_code)}</span>
        </div>
        <div className="flex flex-wrap justify-end gap-6 text-sm">
          <span className="text-slate-600 dark:text-muted-foreground">{t('remaining')}</span>
          <span className="font-semibold text-slate-900 dark:text-foreground">{formatMoney(inv.remaining, inv.currency_code)}</span>
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

      {inv.notes ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-border dark:bg-card">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-foreground">{t('notes')}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-muted-foreground">{inv.notes}</p>
        </section>
      ) : null}

      {inv.payments.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-foreground">{t('paymentsRecorded')}</h2>
          <InvoicePaymentsList
            payments={inv.payments}
            invoiceCurrency={inv.currency_code}
            defaultAppCurrency={defaultAppCurrency}
            remaining={inv.remaining}
            ratesToDefault={ratesToDefault}
          />
        </section>
      ) : null}
    </div>
  )
}
