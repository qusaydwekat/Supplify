'use client'

import type { ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'

type Props = {
  locale: string
  messages: Record<string, unknown>
  children: ReactNode
}

/** Client-only provider so `NextIntlClientProvider` always comes from the client bundle with an explicit `locale`. */
export function IntlClientProvider({ locale, messages, children }: Props) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
