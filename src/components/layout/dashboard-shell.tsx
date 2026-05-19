'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

type Props = {
  role: 'supplier' | 'retailer'
  userName: string
  businessName: string
  children: React.ReactNode
}

export function DashboardShell({ role, userName, businessName, children }: Props) {
  const [mobileNav, setMobileNav] = useState(false)
  const t = useTranslations('Header')

  useEffect(() => {
    if (!mobileNav) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileNav])

  const title = role === 'supplier' ? t('supplier') : t('retailer')

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-border bg-card md:flex">
        <Sidebar role={role} userName={userName} businessName={businessName} />
      </aside>

      {mobileNav ? (
        <div
          className="fixed inset-0 z-[60] md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t('navigation')}
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            aria-label={t('closeMenu')}
            onClick={() => setMobileNav(false)}
          />
          <div className="absolute start-0 top-0 flex h-full w-[min(20rem,88vw)] flex-col bg-card shadow-2xl shadow-slate-900/20">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
              <span className="font-semibold tracking-tight text-foreground">{t('menu')}</span>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label={t('closeMenu')}
                onClick={() => setMobileNav(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Sidebar
                role={role}
                userName={userName}
                businessName={businessName}
                onNavigate={() => setMobileNav(false)}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <Header title={title} role={role} onOpenMenu={() => setMobileNav(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
