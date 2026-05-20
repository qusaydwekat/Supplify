import { getRequestConfig } from 'next-intl/server'
import { APP_TIME_ZONE } from '@/i18n/config'
import { resolveLocale } from '@/i18n/locale'
import { deepMergeMessages } from '@/i18n/merge-messages'

export default getRequestConfig(async () => {
  const locale = await resolveLocale()
  const arMessages = (await import('../../messages/ar.json')).default
  const overlay = (await import('../../messages/en.overlay.json')).default
  const messages =
    locale === 'en' ? (deepMergeMessages(arMessages, overlay) as typeof arMessages) : arMessages

  return {
    locale,
    messages,
    timeZone: APP_TIME_ZONE,
  }
})
