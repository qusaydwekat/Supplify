import type { Metadata } from 'next'
import { Tajawal } from 'next/font/google'
import { getLocale, getMessages, getTranslations } from 'next-intl/server'
import { APP_TIME_ZONE } from '@/i18n/config'
import './globals.css'
import { AppToaster } from '@/components/toaster'
import { IntlClientProvider } from '@/components/providers/intl-client-provider'

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700', '800'],
  display: 'swap',
  variable: '--font-ar',
})

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata')
  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  const dir = locale === 'ar' ? 'rtl' : 'ltr'

  return (
    <html lang={locale} dir={dir} className={`${tajawal.variable} h-full`}>
      <body className={`${tajawal.className} flex min-h-dvh flex-col font-sans`}>
        <IntlClientProvider locale={locale} messages={messages as Record<string, unknown>} timeZone={APP_TIME_ZONE}>
          {children}
          <AppToaster />
        </IntlClientProvider>
      </body>
    </html>
  )
}
