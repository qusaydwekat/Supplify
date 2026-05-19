'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { isAppLocale, localeCookieName } from '@/i18n/routing'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export async function setPreferredLocale(locale: string): Promise<{ ok: boolean; error: string | null }> {
  if (!isAppLocale(locale)) {
    return { ok: false, error: 'Unsupported locale' }
  }
  const jar = await cookies()
  jar.set(localeCookieName, locale, {
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: false,
  })
  revalidatePath('/', 'layout')
  return { ok: true, error: null }
}
