/** PDF-safe money (no special currency glyphs). */

import type { AppLocale } from '@/i18n/routing'
import { formatDateMedium } from '@/lib/format-datetime'

export function formatPdfMoney(amount: number, currencyCode: string, locale: AppLocale): string {
  const code = (currencyCode || 'USD').trim().toUpperCase()
  const n = Number.isFinite(amount) ? amount : 0
  // Latin digits in PDFs — Arabic locale digits break some font/layout paths in react-pdf.
  const formatted = n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${code} ${formatted}`
}

export function formatPdfDate(value: string | null | undefined, locale: AppLocale): string {
  return formatDateMedium(value, locale)
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
