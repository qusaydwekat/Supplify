'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  createForgotPasswordRequestSchema,
  createRetailerPasswordResetPhoneSchema,
  createRetailerPasswordResetCompleteSchema,
  type ForgotPasswordRequestInput,
  type RetailerPasswordResetPhoneInput,
  type RetailerPasswordResetCompleteInput,
} from '@/lib/validations/auth'
import {
  requestPasswordReset,
  sendRetailerPasswordResetOtp,
  completeRetailerPasswordReset,
} from '@/lib/actions/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const OTP_RESEND_MS = 60_000

export default function ForgotPasswordPage() {
  const t = useTranslations('Auth')
  const tV = useTranslations('Validation')
  const [mode, setMode] = useState<'email' | 'phone'>('email')
  const [phoneStep, setPhoneStep] = useState<1 | 2>(1)
  const lastOtpSent = useRef(0)
  const savedPhone = useRef('')

  const emailForm = useForm<ForgotPasswordRequestInput>({
    resolver: zodResolver(createForgotPasswordRequestSchema(tV)),
  })

  const phoneForm1 = useForm<RetailerPasswordResetPhoneInput>({
    resolver: zodResolver(createRetailerPasswordResetPhoneSchema(tV)),
  })

  const phoneForm2 = useForm<RetailerPasswordResetCompleteInput>({
    resolver: zodResolver(createRetailerPasswordResetCompleteSchema(tV)),
  })

  const switchMode = (next: 'email' | 'phone') => {
    setMode(next)
    setPhoneStep(1)
    phoneForm2.reset()
  }

  const onEmailSubmit = emailForm.handleSubmit(async (values) => {
    const res = await requestPasswordReset(values)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('forgotSuccess'))
  })

  const onPhoneStep1 = phoneForm1.handleSubmit(async (values) => {
    const res = await sendRetailerPasswordResetOtp(values)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('otpSent'))
    lastOtpSent.current = Date.now()
    savedPhone.current = values.phone
    phoneForm2.setValue('phone', values.phone)
    setPhoneStep(2)
  })

  const onPhoneStep2 = phoneForm2.handleSubmit(async (values) => {
    const res = await completeRetailerPasswordReset(values)
    if (res.error === 'NOT_RETAILER_PHONE') {
      toast.error(t('forgotPhoneNotRetailer'))
      return
    }
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('resetSuccess'))
    window.location.assign('/login')
  })

  const resendOtp = () => {
    const now = Date.now()
    if (now - lastOtpSent.current < OTP_RESEND_MS) {
      toast.error(t('otpResendWait'))
      return
    }
    void sendRetailerPasswordResetOtp({ phone: savedPhone.current }).then((res) => {
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(t('otpResent'))
      lastOtpSent.current = Date.now()
    })
  }

  const subtitle =
    mode === 'email'
      ? t('forgotSubtitle')
      : phoneStep === 1
        ? t('forgotSubtitlePhone')
        : t('forgotPhoneStep2Hint')

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
      <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-xl shadow-slate-900/10 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('forgotTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>

        <div className="mt-6">
          <span className="form-label">{t('forgotMethodLabel')}</span>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <input
                type="radio"
                name="forgot-method"
                checked={mode === 'email'}
                onChange={() => switchMode('email')}
                className="text-primary"
              />
              <span className="font-medium text-foreground">{t('forgotMethodEmail')}</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <input
                type="radio"
                name="forgot-method"
                checked={mode === 'phone'}
                onChange={() => switchMode('phone')}
                className="text-primary"
              />
              <span className="font-medium text-foreground">{t('forgotMethodPhone')}</span>
            </label>
          </div>
        </div>

        {mode === 'email' ? (
          <form onSubmit={onEmailSubmit} className="mt-8 space-y-5">
            <div>
              <label className="form-label" htmlFor="forgot-email">
                {t('email')}
              </label>
              <Input id="forgot-email" className="mt-1.5" type="email" autoComplete="email" {...emailForm.register('email')} />
              {emailForm.formState.errors.email ? (
                <p className="mt-1.5 text-sm text-destructive">{emailForm.formState.errors.email.message}</p>
              ) : null}
            </div>

            <Button className="w-full" type="submit" disabled={emailForm.formState.isSubmitting}>
              {emailForm.formState.isSubmitting ? t('forgotSending') : t('forgotSubmit')}
            </Button>
          </form>
        ) : phoneStep === 1 ? (
          <form onSubmit={onPhoneStep1} className="mt-8 space-y-5">
            <div>
              <label className="form-label" htmlFor="forgot-phone">
                {t('phone')}
              </label>
              <Input
                id="forgot-phone"
                className="mt-1.5"
                type="tel"
                autoComplete="tel"
                placeholder="+962791234567"
                {...phoneForm1.register('phone')}
              />
              <p className="form-hint mt-1.5">{t('phoneE164Hint')}</p>
              {phoneForm1.formState.errors.phone ? (
                <p className="mt-1.5 text-sm text-destructive">{phoneForm1.formState.errors.phone.message}</p>
              ) : null}
            </div>

            <Button className="w-full" type="submit" disabled={phoneForm1.formState.isSubmitting}>
              {phoneForm1.formState.isSubmitting ? t('otpSending') : t('otpSend')}
            </Button>
          </form>
        ) : (
          <form onSubmit={onPhoneStep2} className="mt-8 space-y-5">
            <p className="text-sm font-medium text-foreground">{t('forgotPhoneStep2Title')}</p>
            <input type="hidden" {...phoneForm2.register('phone')} />

            <div>
              <label className="form-label" htmlFor="forgot-otp">
                {t('otpCode')}
              </label>
              <Input
                id="forgot-otp"
                className="mt-1.5"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                {...phoneForm2.register('token')}
              />
              {phoneForm2.formState.errors.token ? (
                <p className="mt-1.5 text-sm text-destructive">{phoneForm2.formState.errors.token.message}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="form-label" htmlFor="forgot-password">
                  {t('password')}
                </label>
                <Input
                  id="forgot-password"
                  className="mt-1.5"
                  type="password"
                  autoComplete="new-password"
                  {...phoneForm2.register('password')}
                />
                {phoneForm2.formState.errors.password ? (
                  <p className="mt-1.5 text-sm text-destructive">{phoneForm2.formState.errors.password.message}</p>
                ) : null}
              </div>
              <div>
                <label className="form-label" htmlFor="forgot-confirm">
                  {t('confirmPassword')}
                </label>
                <Input
                  id="forgot-confirm"
                  className="mt-1.5"
                  type="password"
                  autoComplete="new-password"
                  {...phoneForm2.register('confirmPassword')}
                />
                {phoneForm2.formState.errors.confirmPassword ? (
                  <p className="mt-1.5 text-sm text-destructive">{phoneForm2.formState.errors.confirmPassword.message}</p>
                ) : null}
              </div>
            </div>

            <Button className="w-full" type="submit" disabled={phoneForm2.formState.isSubmitting}>
              {phoneForm2.formState.isSubmitting ? t('resetUpdating') : t('resetSubmit')}
            </Button>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <button type="button" className="font-semibold text-primary hover:underline" onClick={resendOtp}>
                {t('otpResend')}
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground hover:underline"
                onClick={() => {
                  setPhoneStep(1)
                  phoneForm2.reset()
                }}
              >
                {t('otpBackEdit')}
              </button>
            </div>
          </form>
        )}

        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-semibold text-primary hover:underline">
            {t('forgotBackToLogin')}
          </Link>
        </p>
      </div>
    </main>
  )
}
