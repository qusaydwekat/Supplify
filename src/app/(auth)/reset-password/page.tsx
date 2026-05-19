'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { createBrowserClient } from '@supabase/ssr'
import { createResetPasswordSchema, type ResetPasswordInput } from '@/lib/validations/auth'
import { updatePasswordAfterReset } from '@/lib/actions/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function ResetPasswordPage() {
  const t = useTranslations('Auth')
  const tCommon = useTranslations('Common')
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      setHasSession(false)
      return
    }
    const supabase = createBrowserClient(url, key)
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session)
    })
  }, [])

  const tV = useTranslations('Validation')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(createResetPasswordSchema(tV)) })

  const onSubmit = handleSubmit(async (values) => {
    const res = await updatePasswordAfterReset(values)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('resetSuccess'))
    window.location.assign('/login')
  })

  if (hasSession === null) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-center text-sm text-muted-foreground">{tCommon('loading')}</p>
      </main>
    )
  }

  if (hasSession === false) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
        <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8">
          <p className="text-center text-sm text-muted-foreground">{t('resetInvalidSession')}</p>
          <p className="mt-6 text-center">
            <Link href="/forgot-password" className="font-semibold text-primary hover:underline">
              {t('forgotSubmit')}
            </Link>
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
      <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-xl shadow-slate-900/10 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('resetTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('resetSubtitle')}</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label className="form-label" htmlFor="reset-password">
              {t('password')}
            </label>
            <Input
              id="reset-password"
              className="mt-1.5"
              type="password"
              autoComplete="new-password"
              {...register('password')}
            />
            {errors.password ? <p className="mt-1.5 text-sm text-destructive">{errors.password.message}</p> : null}
          </div>

          <div>
            <label className="form-label" htmlFor="reset-confirm">
              {t('confirmPassword')}
            </label>
            <Input
              id="reset-confirm"
              className="mt-1.5"
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword ? (
              <p className="mt-1.5 text-sm text-destructive">{errors.confirmPassword.message}</p>
            ) : null}
          </div>

          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('resetUpdating') : t('resetSubmit')}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-semibold text-primary hover:underline">
            {t('signInLink')}
          </Link>
        </p>
      </div>
    </main>
  )
}
