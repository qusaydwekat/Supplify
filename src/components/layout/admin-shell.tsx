'use client'

import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AdminSidebar } from '@/components/layout/admin-sidebar'
import { LanguageSwitcher } from '@/components/layout/language-switcher'

type Props = {
  userName: string
  email: string | null
  children: React.ReactNode
}

export function AdminShell({ userName, email, children }: Props) {
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

  const tAdmin = useTranslations('Admin')

  return (
    <div className="flex min-h-dvh bg-muted/30">
      <aside className="sticky top-0 hidden h-dvh w-[min(18rem,92vw)] shrink-0 flex-col border-e border-slate-800 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100 md:flex">
        <AdminSidebar userName={userName} email={email} />
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
          <div className="absolute start-0 top-0 flex h-full w-[min(20rem,88vw)] flex-col border-e border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100 shadow-2xl shadow-slate-900/40">
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
              <AdminSidebar userName={userName} email={email} onNavigate={() => setMobileNav(false)} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-card/80 sm:h-16 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNav(true)}
              className="-ms-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground transition hover:bg-muted md:hidden"
              aria-label={t('menu')}
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {tAdmin('panelTitle')}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <LanguageSwitcher />
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-muted/20 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
