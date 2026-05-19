export const locales = ['ar', 'en'] as const
export type AppLocale = (typeof locales)[number]

export const defaultLocale: AppLocale = 'ar'

export const localeCookieName = 'NEXT_LOCALE'

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return value === 'ar' || value === 'en'
}
