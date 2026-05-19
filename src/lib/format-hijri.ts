/**
 * Hijri (Umm al-Qura) date formatting helpers.
 *
 * Uses the browser/Node `Intl` API with the `islamic-umalqura` calendar, which
 * matches the calendar used by the Palestinian Ministry of Awqaf for official
 * documents and the public holiday calendar.
 *
 * These helpers are safe to call from server components.
 */

export type HijriFormatStyle = 'short' | 'long'

const FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>()

function fmt(locale: string, style: HijriFormatStyle): Intl.DateTimeFormat {
  const key = `${locale}|${style}`
  const cached = FORMATTER_CACHE.get(key)
  if (cached) return cached
  const calendarLocale = locale.includes('-u-')
    ? locale
    : `${locale}-u-ca-islamic-umalqura`
  const next = new Intl.DateTimeFormat(calendarLocale, {
    calendar: 'islamic-umalqura',
    day: '2-digit',
    month: style === 'long' ? 'long' : '2-digit',
    year: 'numeric',
  })
  FORMATTER_CACHE.set(key, next)
  return next
}

function coerceDate(value: string | number | Date | null | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatHijriDate(
  value: string | number | Date | null | undefined,
  locale: 'ar' | 'en' = 'ar',
  style: HijriFormatStyle = 'short',
): string | null {
  const d = coerceDate(value)
  if (!d) return null
  try {
    return fmt(locale, style).format(d)
  } catch {
    return null
  }
}

/**
 * Combine a Gregorian formatted date with the Hijri equivalent, joined by " / ".
 * Used in document headers and order/invoice rows.
 */
export function formatDualDate(
  value: string | number | Date | null | undefined,
  gregorian: string,
  locale: 'ar' | 'en' = 'ar',
  style: HijriFormatStyle = 'short',
): string {
  const hijri = formatHijriDate(value, locale, style)
  if (!hijri) return gregorian
  return `${gregorian} / ${hijri} هـ`
}
