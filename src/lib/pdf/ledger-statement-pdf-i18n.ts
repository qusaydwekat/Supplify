import type { AppLocale } from '@/i18n/routing'
import type { LedgerEntryType } from '@/lib/data/ledger'
import { deepMergeMessages } from '@/i18n/merge-messages'
import { formatLabel } from '@/lib/pdf/invoice-pdf-i18n'
import { formatPdfDate } from '@/lib/pdf/pdf-format'

export type LedgerStatementPdfLabels = {
  documentTitle: string
  brand: string
  headerTitle: string
  headerSub: string
  supplier: string
  retailer: string
  allRetailers: string
  generated: string
  currency: string
  periodLabel: string
  periodAll: string
  periodFromTo: string
  periodFrom: string
  periodTo: string
  summaryTitle: string
  totalInvoiced: string
  totalCollected: string
  outstanding: string
  transactions: string
  colDate: string
  colType: string
  colParty: string
  colDescription: string
  colAmount: string
  colBalance: string
  typeInvoice: string
  typePayment: string
  typeCreditNote: string
  typeDebitNote: string
  footerThanks: string
  footerRef: string
}

type LedgerStatementPdfMessages = LedgerStatementPdfLabels

async function loadMessages(locale: AppLocale) {
  const ar = (await import('../../../messages/ar.json')).default
  if (locale === 'ar') return ar
  const overlay = (await import('../../../messages/en.overlay.json')).default
  return deepMergeMessages(ar, overlay)
}

export async function loadLedgerStatementPdfLabels(locale: AppLocale): Promise<LedgerStatementPdfLabels> {
  const messages = await loadMessages(locale)
  const block = (messages as { LedgerStatementPdf?: LedgerStatementPdfMessages }).LedgerStatementPdf
  if (!block) {
    throw new Error('Missing LedgerStatementPdf messages')
  }
  return block
}

export function buildStatementPeriodLabel(
  labels: LedgerStatementPdfLabels,
  locale: AppLocale,
  filters: { from?: string | null; to?: string | null },
): string {
  const from = filters.from?.trim()
  const to = filters.to?.trim()
  if (from && to) {
    return formatLabel(labels.periodFromTo, {
      from: formatPdfDate(from, locale),
      to: formatPdfDate(to, locale),
    })
  }
  if (from) return formatLabel(labels.periodFrom, { from: formatPdfDate(from, locale) })
  if (to) return formatLabel(labels.periodTo, { to: formatPdfDate(to, locale) })
  return labels.periodAll
}

export function ledgerTypeLabel(labels: LedgerStatementPdfLabels, type: LedgerEntryType): string {
  switch (type) {
    case 'invoice':
      return labels.typeInvoice
    case 'payment':
      return labels.typePayment
    case 'credit_note':
      return labels.typeCreditNote
    case 'debit_note':
      return labels.typeDebitNote
    default:
      return type
  }
}
