import type { AppLocale } from '@/i18n/routing'
import type { LedgerListRow } from '@/lib/data/ledger'
import type { LedgerStatementPdfLabels } from '@/lib/pdf/ledger-statement-pdf-i18n'

export type LedgerStatementPdfProps = {
  locale: AppLocale
  labels: LedgerStatementPdfLabels
  supplierName: string
  retailerName: string | null
  currencyCode: string
  periodFrom: string | null
  periodTo: string | null
  generatedAt: string
  totalInvoiced: number
  totalCollected: number
  netBalance: number
  rows: LedgerListRow[]
}
