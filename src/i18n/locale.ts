import { cookies } from 'next/headers'
import { defaultLocale, isAppLocale, localeCookieName, type AppLocale } from '@/i18n/routing'

export async function resolveLocale(): Promise<AppLocale> {
  const raw = (await cookies()).get(localeCookieName)?.value
  return isAppLocale(raw) ? raw : defaultLocale
}
