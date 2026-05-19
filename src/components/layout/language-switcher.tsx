'use client'

import { useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { setPreferredLocale } from '@/lib/actions/locale'
import { locales, type AppLocale } from '@/i18n/routing'
import { cn } from '@/lib/utils'

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as AppLocale
  const router = useRouter()
  const t = useTranslations('Language')
  const [pending, startTransition] = useTransition()

  function select(next: AppLocale) {
    if (next === locale) return
    startTransition(async () => {
      await setPreferredLocale(next)
      router.refresh()
    })
  }

  return (
    <div
      className={cn('inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5', className)}
      role="group"
      aria-label={t('switcherLabel')}
    >
      {locales.map((code) => (
        <button
          key={code}
          type="button"
          disabled={pending}
          onClick={() => select(code)}
          className={cn(
            'min-h-8 rounded-md px-2.5 py-1 text-xs font-semibold transition',
            locale === code
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {code === 'ar' ? t('langArabic') : t('langEnglish')}
        </button>
      ))}
    </div>
  )
}
