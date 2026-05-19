'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { signOutToLogin } from '@/lib/actions/auth'

const REDIRECT_SECONDS = 4

export default function EmailVerifiedPage() {
  const t = useTranslations('Auth')
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS)

  useEffect(() => {
    let cancelled = false
    let left = REDIRECT_SECONDS
    const id = window.setInterval(() => {
      left -= 1
      if (!cancelled) setSecondsLeft(left)
      if (left <= 0) {
        window.clearInterval(id)
        if (!cancelled) void signOutToLogin()
      }
    }, 1000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
      <div className="w-full rounded-2xl border border-border bg-card p-6 text-center shadow-xl shadow-slate-900/10 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('emailVerifiedTitle')}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t('emailVerifiedSubtitle')}</p>
        <p className="mt-6 text-sm font-medium text-foreground">
          {t('emailVerifiedRedirect', { seconds: Math.max(0, secondsLeft) })}
        </p>
      </div>
    </main>
  )
}
