import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { cn } from '@/lib/utils'

const btnPrimary =
  'inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-md active:scale-[0.98] sm:w-auto'

const btnSecondary =
  'inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-all hover:bg-muted active:scale-[0.98] sm:w-auto'

export default async function Home() {
  const t = await getTranslations('Home')

  return (
    <main className="relative flex flex-1 flex-col">
      <div className="absolute end-4 top-4 z-10 sm:end-6 sm:top-6">
        <LanguageSwitcher />
      </div>
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-16 sm:px-6">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(13,148,136,0.2),transparent)]"
          aria-hidden
        />
        <div className="relative z-[1] mx-auto w-full max-w-lg text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">{t('tagline')}</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{t('title')}</h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">{t('subtitle')}</p>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link href="/login" className={cn(btnPrimary)}>
              {t('signIn')}
            </Link>
            <Link href="/register" className={cn(btnSecondary)}>
              {t('createAccount')}
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
