import type { AppLocale } from '@/i18n/routing'
import { defaultLocale, isAppLocale } from '@/i18n/routing'

/** BCP 47 tag for `Intl` from app locale (`en` uses generic English conventions). */
export function intlLocaleForApp(locale: AppLocale): string {
  return locale === 'ar' ? 'ar' : 'en'
}

export function normalizeAppLocale(value: string): AppLocale {
  return isAppLocale(value) ? value : defaultLocale
}

type DateInput = string | number | Date

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value)
}

/** Gregorian calendar (explicit) for Arabic + English business dates. */
const GREGORY: Intl.DateTimeFormatOptions = { calendar: 'gregory' }

export function formatDateTimeShort(value: DateInput, locale: AppLocale): string {
  return new Intl.DateTimeFormat(intlLocaleForApp(locale), {
    ...GREGORY,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(toDate(value))
}

export function formatDateShort(value: DateInput, locale: AppLocale): string {
  return new Intl.DateTimeFormat(intlLocaleForApp(locale), {
    ...GREGORY,
    dateStyle: 'short',
  }).format(toDate(value))
}

export function formatDateMedium(value: DateInput | null | undefined, locale: AppLocale): string {
  if (value == null || value === '') return '—'
  const d = toDate(value as DateInput)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(intlLocaleForApp(locale), {
    ...GREGORY,
    dateStyle: 'medium',
  }).format(d)
}

export function formatTimeShort(value: DateInput, locale: AppLocale): string {
  return new Intl.DateTimeFormat(intlLocaleForApp(locale), {
    ...GREGORY,
    timeStyle: 'short',
  }).format(toDate(value))
}

/** e.g. 3 May 2026 */
export function formatDateDayMonthYear(value: DateInput | null | undefined, locale: AppLocale): string {
  if (value == null || value === '') return '—'
  const d = toDate(value as DateInput)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(intlLocaleForApp(locale), {
    ...GREGORY,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d)
}

/** Chart / pivot month label */
export function formatMonthYear(value: DateInput, locale: AppLocale): string {
  return new Intl.DateTimeFormat(intlLocaleForApp(locale), {
    ...GREGORY,
    year: 'numeric',
    month: 'short',
  }).format(toDate(value))
}
