'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { createForgotPasswordRequestSchema, type ForgotPasswordRequestInput } from '@/lib/validations/auth'
import { requestPasswordReset } from '@/lib/actions/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function ForgotPasswordPage() {
  const t = useTranslations('Auth')
  const tV = useTranslations('Validation')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordRequestInput>({ resolver: zodResolver(createForgotPasswordRequestSchema(tV)) })

  const onSubmit = handleSubmit(async (values) => {
    const res = await requestPasswordReset(values)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('forgotSuccess'))
  })

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
      <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-xl shadow-slate-900/10 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('forgotTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('forgotSubtitle')}</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label className="form-label" htmlFor="forgot-email">
              {t('email')}
            </label>
            <Input id="forgot-email" className="mt-1.5" type="email" autoComplete="email" {...register('email')} />
            {errors.email ? <p className="mt-1.5 text-sm text-destructive">{errors.email.message}</p> : null}
          </div>

          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('forgotSending') : t('forgotSubmit')}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-semibold text-primary hover:underline">
            {t('forgotBackToLogin')}
          </Link>
        </p>
      </div>
    </main>
  )
}
