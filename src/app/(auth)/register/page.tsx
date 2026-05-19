'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  createSupplierRegisterSchema,
  createRetailerRegisterStep1Schema,
  createRetailerVerifySchema,
  type SupplierRegisterFormInput,
  type SupplierRegisterInput,
  type RetailerRegisterStep1Input,
  type RetailerVerifyInput,
} from '@/lib/validations/auth'
import {
  registerUser,
  sendRetailerRegistrationOtp,
  completeRetailerRegistration,
} from '@/lib/actions/auth'
import { MARKETPLACE_CATEGORY_SLUGS } from '@/lib/supplier-marketplace-categories'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const OTP_RESEND_MS = 60_000

export default function RegisterPage() {
  const t = useTranslations('Auth')
  const tV = useTranslations('Validation')
  const tMarketplace = useTranslations('MarketplaceCategories')
  const [role, setRole] = useState<'supplier' | 'retailer'>('retailer')
  const [retailerStep, setRetailerStep] = useState<1 | 2>(1)
  const lastOtpSent = useRef(0)

  const supplierForm = useForm<SupplierRegisterFormInput>({
    resolver: zodResolver(createSupplierRegisterSchema(tV)),
    defaultValues: {
      marketplaceCategory: '',
    },
  })

  const retailerForm1 = useForm<RetailerRegisterStep1Input>({
    resolver: zodResolver(createRetailerRegisterStep1Schema(tV)),
    defaultValues: { email: '', city: '', address: '' },
  })

  const retailerForm2 = useForm<RetailerVerifyInput>({
    resolver: zodResolver(createRetailerVerifySchema(tV)),
  })

  useEffect(() => {
    setRetailerStep(1)
    retailerForm2.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset step when switching account type
  }, [role])

  const onSupplierSubmit = supplierForm.handleSubmit(async (values) => {
    const res = await registerUser(values)
    if (res.error) {
      toast.error(res.error)
      return
    }
    if (res.data?.needsEmailVerification) {
      toast.success(t('checkEmail'))
      window.location.assign('/login')
      return
    }
    toast.success(t('registerSuccess'))
    window.location.assign('/')
  })

  const submitRetailerOtpRequest = retailerForm1.handleSubmit(async (values) => {
    const res = await sendRetailerRegistrationOtp(values)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('otpSent'))
    lastOtpSent.current = Date.now()
    setRetailerStep(2)
  })

  const onRetailerStep2Submit = retailerForm2.handleSubmit(async (v2) => {
    const v1 = retailerForm1.getValues()
    const res = await completeRetailerRegistration({ ...v1, ...v2 })
    if (res.error) {
      toast.error(res.error)
      return
    }
    if (res.data?.needsEmailVerification) {
      toast.success(t('checkEmail'))
      window.location.assign('/login')
      return
    }
    toast.success(t('registerSuccess'))
    window.location.assign('/')
  })

  const resendOtp = () => {
    const now = Date.now()
    if (now - lastOtpSent.current < OTP_RESEND_MS) {
      toast.error(t('otpResendWait'))
      return
    }
    void retailerForm1.handleSubmit(async (values) => {
      const res = await sendRetailerRegistrationOtp(values)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(t('otpResent'))
      lastOtpSent.current = Date.now()
    })()
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-slate-900/10">
        <div className="border-b border-border bg-muted/30 px-6 py-5 sm:px-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('registerTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('registerSubtitle')}</p>
        </div>

        <div className="px-6 pb-6 pt-6 sm:px-8 sm:pb-8">
        <div>
          <span className="form-label">{t('accountType')}</span>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <input
                type="radio"
                name="account-role"
                checked={role === 'supplier'}
                onChange={() => setRole('supplier')}
                className="text-primary"
              />
              <span className="font-medium text-foreground">{t('supplier')}</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <input
                type="radio"
                name="account-role"
                checked={role === 'retailer'}
                onChange={() => setRole('retailer')}
                className="text-primary"
              />
              <span className="font-medium text-foreground">{t('retailer')}</span>
            </label>
          </div>
          <p className="form-hint mt-2">
            {t('selected')}: {role === 'supplier' ? t('supplier') : t('retailer')}
          </p>
        </div>

        {role === 'supplier' ? (
          <form onSubmit={onSupplierSubmit} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="form-label" htmlFor="reg-business">
                  {t('businessName')}
                </label>
                <Input id="reg-business" className="mt-1.5" {...supplierForm.register('businessName')} />
                {supplierForm.formState.errors.businessName ? (
                  <p className="mt-1.5 text-sm text-destructive">{supplierForm.formState.errors.businessName.message}</p>
                ) : null}
              </div>
              <div>
                <label className="form-label" htmlFor="reg-name">
                  {t('fullName')}
                </label>
                <Input id="reg-name" className="mt-1.5" {...supplierForm.register('fullName')} />
                {supplierForm.formState.errors.fullName ? (
                  <p className="mt-1.5 text-sm text-destructive">{supplierForm.formState.errors.fullName.message}</p>
                ) : null}
              </div>
            </div>

            <div>
              <label className="form-label" htmlFor="reg-email">
                {t('email')}
              </label>
              <Input id="reg-email" className="mt-1.5" type="email" autoComplete="email" {...supplierForm.register('email')} />
              {supplierForm.formState.errors.email ? (
                <p className="mt-1.5 text-sm text-destructive">{supplierForm.formState.errors.email.message}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="form-label" htmlFor="reg-phone">
                  {t('phone')}
                </label>
                <Input id="reg-phone" className="mt-1.5" autoComplete="tel" {...supplierForm.register('phone')} />
                {supplierForm.formState.errors.phone ? (
                  <p className="mt-1.5 text-sm text-destructive">{supplierForm.formState.errors.phone.message}</p>
                ) : null}
              </div>
              <div>
                <label className="form-label" htmlFor="reg-city">
                  {t('city')}
                </label>
                <Input id="reg-city" className="mt-1.5" autoComplete="address-level2" {...supplierForm.register('city')} />
                {supplierForm.formState.errors.city ? (
                  <p className="mt-1.5 text-sm text-destructive">{supplierForm.formState.errors.city.message}</p>
                ) : null}
              </div>
            </div>

            <div>
              <label className="form-label" htmlFor="reg-category">
                {t('supplierBusinessCategory')} <span className="text-destructive">*</span>
              </label>
              <select
                id="reg-category"
                required
                className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                {...supplierForm.register('marketplaceCategory')}
              >
                <option value="">{t('supplierBusinessCategoryPlaceholder')}</option>
                {MARKETPLACE_CATEGORY_SLUGS.map((slug) => (
                  <option key={slug} value={slug}>
                    {tMarketplace(slug)}
                  </option>
                ))}
              </select>
              <p className="form-hint mt-1.5">{t('supplierBusinessCategoryHint')}</p>
              {supplierForm.formState.errors.marketplaceCategory ? (
                <p className="mt-1.5 text-sm text-destructive">
                  {supplierForm.formState.errors.marketplaceCategory.message}
                </p>
              ) : null}
            </div>

            <div>
              <label className="form-label" htmlFor="reg-address">
                {t('address')}
              </label>
              <Input
                id="reg-address"
                className="mt-1.5"
                autoComplete="street-address"
                placeholder={t('addressPlaceholder')}
                {...supplierForm.register('address')}
              />
              {supplierForm.formState.errors.address ? (
                <p className="mt-1.5 text-sm text-destructive">{supplierForm.formState.errors.address.message}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="form-label" htmlFor="reg-password">
                  {t('password')}
                </label>
                <Input
                  id="reg-password"
                  className="mt-1.5"
                  type="password"
                  autoComplete="new-password"
                  {...supplierForm.register('password')}
                />
                {supplierForm.formState.errors.password ? (
                  <p className="mt-1.5 text-sm text-destructive">{supplierForm.formState.errors.password.message}</p>
                ) : null}
              </div>
              <div>
                <label className="form-label" htmlFor="reg-confirm">
                  {t('confirmPassword')}
                </label>
                <Input
                  id="reg-confirm"
                  className="mt-1.5"
                  type="password"
                  autoComplete="new-password"
                  {...supplierForm.register('confirmPassword')}
                />
                {supplierForm.formState.errors.confirmPassword ? (
                  <p className="mt-1.5 text-sm text-destructive">{supplierForm.formState.errors.confirmPassword.message}</p>
                ) : null}
              </div>
            </div>

            <Button className="w-full" type="submit" disabled={supplierForm.formState.isSubmitting}>
              {supplierForm.formState.isSubmitting ? t('creating') : t('createAccount')}
            </Button>
          </form>
        ) : retailerStep === 1 ? (
          <form onSubmit={submitRetailerOtpRequest} className="mt-6 space-y-4">
            <p className="text-sm font-medium text-foreground">{t('retailerStep1Title')}</p>
            <div>
              <label className="form-label" htmlFor="ret-phone">
                {t('phone')} <span className="text-destructive">*</span>
              </label>
              <Input id="ret-phone" className="mt-1.5" type="tel" autoComplete="tel" placeholder="+962791234567" {...retailerForm1.register('phone')} />
              <p className="form-hint mt-1.5">{t('phoneE164Hint')}</p>
              {retailerForm1.formState.errors.phone ? (
                <p className="mt-1.5 text-sm text-destructive">{retailerForm1.formState.errors.phone.message}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="form-label" htmlFor="ret-business">
                  {t('businessName')}
                </label>
                <Input id="ret-business" className="mt-1.5" {...retailerForm1.register('businessName')} />
                {retailerForm1.formState.errors.businessName ? (
                  <p className="mt-1.5 text-sm text-destructive">{retailerForm1.formState.errors.businessName.message}</p>
                ) : null}
              </div>
              <div>
                <label className="form-label" htmlFor="ret-name">
                  {t('fullName')}
                </label>
                <Input id="ret-name" className="mt-1.5" {...retailerForm1.register('fullName')} />
                {retailerForm1.formState.errors.fullName ? (
                  <p className="mt-1.5 text-sm text-destructive">{retailerForm1.formState.errors.fullName.message}</p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="form-label" htmlFor="ret-city">
                  {t('city')}
                </label>
                <Input id="ret-city" className="mt-1.5" autoComplete="address-level2" {...retailerForm1.register('city')} />
                {retailerForm1.formState.errors.city ? (
                  <p className="mt-1.5 text-sm text-destructive">{retailerForm1.formState.errors.city.message}</p>
                ) : null}
              </div>
              <div>
                <label className="form-label" htmlFor="ret-address">
                  {t('address')}
                </label>
                <Input
                  id="ret-address"
                  className="mt-1.5"
                  autoComplete="street-address"
                  placeholder={t('addressPlaceholder')}
                  {...retailerForm1.register('address')}
                />
                {retailerForm1.formState.errors.address ? (
                  <p className="mt-1.5 text-sm text-destructive">{retailerForm1.formState.errors.address.message}</p>
                ) : null}
              </div>
            </div>

            <div>
              <label className="form-label" htmlFor="ret-email">
                {t('emailOptional')}
              </label>
              <Input id="ret-email" className="mt-1.5" type="email" autoComplete="email" {...retailerForm1.register('email')} />
              {retailerForm1.formState.errors.email ? (
                <p className="mt-1.5 text-sm text-destructive">{retailerForm1.formState.errors.email.message}</p>
              ) : null}
            </div>

            <Button className="w-full" type="submit" disabled={retailerForm1.formState.isSubmitting}>
              {retailerForm1.formState.isSubmitting ? t('otpSending') : t('otpSend')}
            </Button>
          </form>
        ) : (
          <form onSubmit={onRetailerStep2Submit} className="mt-6 space-y-4">
            <p className="text-sm font-medium text-foreground">{t('retailerStep2Title')}</p>
            <p className="text-xs text-muted-foreground">{t('retailerStep2Hint')}</p>

            <div>
              <label className="form-label" htmlFor="ret-otp">
                {t('otpCode')}
              </label>
              <Input id="ret-otp" className="mt-1.5" inputMode="numeric" autoComplete="one-time-code" {...retailerForm2.register('token')} />
              {retailerForm2.formState.errors.token ? (
                <p className="mt-1.5 text-sm text-destructive">{retailerForm2.formState.errors.token.message}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="form-label" htmlFor="ret-pw">
                  {t('password')}
                </label>
                <Input id="ret-pw" className="mt-1.5" type="password" autoComplete="new-password" {...retailerForm2.register('password')} />
                {retailerForm2.formState.errors.password ? (
                  <p className="mt-1.5 text-sm text-destructive">{retailerForm2.formState.errors.password.message}</p>
                ) : null}
              </div>
              <div>
                <label className="form-label" htmlFor="ret-pw2">
                  {t('confirmPassword')}
                </label>
                <Input id="ret-pw2" className="mt-1.5" type="password" autoComplete="new-password" {...retailerForm2.register('confirmPassword')} />
                {retailerForm2.formState.errors.confirmPassword ? (
                  <p className="mt-1.5 text-sm text-destructive">{retailerForm2.formState.errors.confirmPassword.message}</p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button className="w-full sm:flex-1" type="submit" disabled={retailerForm2.formState.isSubmitting}>
                {retailerForm2.formState.isSubmitting ? t('creating') : t('createAccount')}
              </Button>
              <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={resendOtp}>
                {t('otpResend')}
              </Button>
            </div>

            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setRetailerStep(1)}
            >
              {t('otpBackEdit')}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-sm text-muted-foreground">
          {t('haveAccount')}{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            {t('signInLink')}
          </Link>
        </p>
        </div>
      </div>
    </main>
  )
}
