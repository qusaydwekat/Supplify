/** PDF-safe formatting (Latin digits, no Unicode bidi marks — those render as stray "i" in react-pdf). */

import type { AppLocale } from '@/i18n/routing'
import { currencyDisplayLabel } from '@/lib/currency'

type DateInput = string | number | Date

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value)
}

/** dd/mm/yyyy with Latin digits */
export function formatPdfDate(value: string | null | undefined, _locale: AppLocale): string {
  if (value == null || value === '') return '—'
  const d = toDate(value)
  if (Number.isNaN(d.getTime())) return '—'

  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = String(d.getFullYear())

  return `${day}/${month}/${year}`
}

function formatAmountDigits(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Matches app currency labels (NIS for ILS) with Latin digits. */
export function formatPdfMoney(amount: number, currencyCode: string, _locale: AppLocale): string {
  const label = currencyDisplayLabel(currencyCode)
  const nums = formatAmountDigits(amount)

  switch (label) {
    case 'NIS':
      return `NIS ${nums}`
    case 'USD':
      return `USD ${nums}`
    case 'JOD':
      return `JOD ${nums}`
    default:
      return `${label} ${nums}`
  }
}

export function formatPdfCurrencyCode(currencyCode: string): string {
  return currencyDisplayLabel(currencyCode)
}

export function formatLineItemLabel(productName: string, variationName: string | null): {
  primary: string
  secondary: string | null
} {
  const primary = productName.trim() || '—'
  const v = variationName?.trim()
  if (!v || v.toLowerCase() === 'default') {
    return { primary, secondary: null }
  }
  return { primary, secondary: v }
}

/** react-pdf style for Latin/numeric strings inside RTL documents */
export const pdfLtrTextStyle = { direction: 'ltr' as const }
