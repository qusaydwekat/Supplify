'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { currencyDisplayLabel, SUPPORTED_SUPPLIER_CURRENCIES } from '@/lib/currency'
import { supplierProfileSchema, type SupplierProfileInput } from '@/lib/validations/supplier'
import { updateSupplierProfile, uploadSupplierLogo } from '@/lib/actions/supplier'
import { MARKETPLACE_CATEGORY_SLUGS } from '@/lib/supplier-marketplace-categories'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Props = {
  defaultValues: SupplierProfileInput
}

/** Must stay at or below `experimental.serverActions.bodySizeLimit` in next.config.ts */
const MAX_LOGO_BYTES = 12 * 1024 * 1024

export function SupplierProfileForm({ defaultValues }: Props) {
  const t = useTranslations('SupplierProfileForm')
  const tCat = useTranslations('MarketplaceCategories')
  const [logoUrl, setLogoUrl] = useState(defaultValues.logo_url || '')
  const [isUploading, startUploadTransition] = useTransition()
  const [areasInput, setAreasInput] = useState((defaultValues.delivery_areas ?? []).join(', '))

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    getValues,
  } = useForm<SupplierProfileInput>({
    resolver: zodResolver(supplierProfileSchema),
    defaultValues,
  })

  const marketplaceCats = watch('marketplace_categories') ?? []

  const onSubmit = handleSubmit(async (values) => {
    const delivery_areas = areasInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const payload = { ...values, delivery_areas, logo_url: logoUrl }
    const res = await updateSupplierProfile(payload)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('success'))
  })

  const onLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    const file = input.files?.[0]
    if (!file) return
    if (file.size > MAX_LOGO_BYTES) {
      toast.error(t('logoTooLarge', { maxMb: MAX_LOGO_BYTES / (1024 * 1024) }))
      input.value = ''
      return
    }
    startUploadTransition(async () => {
      const fd = new FormData()
      fd.append('file', file)
      try {
        const res = await uploadSupplierLogo(fd)
        if (res.error || !res.data) {
          toast.error(res.error ?? t('uploadFailed'))
          return
        }
        setLogoUrl(res.data.logo_url)
        setValue('logo_url', res.data.logo_url)
        toast.success(t('logoSuccess'))
      } catch (err) {
        const msg =
          err instanceof Error && err.message === 'Failed to fetch'
            ? t('uploadFailedNetwork')
            : err instanceof Error
              ? err.message
              : t('uploadFailed')
        toast.error(msg)
      } finally {
        input.value = ''
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 sm:space-y-8">
      <div>
        <label className="form-label">{t('currency')}</label>
        <select
          className="mt-1.5 w-full max-w-xs rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          {...register('currency_code')}
        >
          {SUPPORTED_SUPPLIER_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {currencyDisplayLabel(c)}
            </option>
          ))}
        </select>
        <p className="form-hint mt-1.5">{t('currencyHint')}</p>
        {errors.currency_code ? <p className="mt-1.5 text-sm text-destructive">{errors.currency_code.message}</p> : null}
      </div>

      <div>
        <label className="form-label">{t('description')}</label>
        <textarea
          className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          rows={4}
          {...register('description')}
        />
        {errors.description && (
          <p className="mt-1.5 text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div>
        <label className="form-label">{t('businessCategories')}</label>
        <p className="form-hint mt-1.5">{t('businessCategoriesHint')}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {MARKETPLACE_CATEGORY_SLUGS.map((slug) => (
            <label
              key={slug}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-sm transition hover:bg-muted/40"
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary"
                checked={marketplaceCats.includes(slug)}
                onChange={(e) => {
                  const cur = getValues('marketplace_categories') ?? []
                  const next = e.target.checked
                    ? [...cur.filter((x) => x !== slug), slug]
                    : cur.filter((x) => x !== slug)
                  setValue('marketplace_categories', next, { shouldDirty: true, shouldValidate: true })
                }}
              />
              <span className="leading-snug">{tCat(slug)}</span>
            </label>
          ))}
        </div>
        {errors.marketplace_categories ? (
          <p className="mt-1.5 text-sm text-destructive">{errors.marketplace_categories.message}</p>
        ) : null}
      </div>

      <div>
        <label className="form-label">{t('deliveryAreas')}</label>
        <Input
          className="mt-1.5"
          placeholder={t('deliveryPlaceholder')}
          value={areasInput}
          onChange={(e) => setAreasInput(e.target.value)}
        />
        <p className="form-hint mt-1.5">{t('deliveryHint')}</p>
      </div>

      <div>
        <label className="form-label">{t('logo')}</label>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={t('logo')} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-muted-foreground">{t('noLogo')}</span>
            )}
          </div>
          <label className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted">
            {isUploading ? t('uploading') : t('uploadLogo')}
            <input type="file" accept="image/*" className="hidden" onChange={onLogoSelect} />
          </label>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/60">
        <input type="checkbox" className="h-4 w-4 rounded border-border text-primary" {...register('is_active')} />
        {t('storefrontActive')}
      </label>

      <div className="pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  )
}
