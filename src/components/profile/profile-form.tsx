'use client'

import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { profileSchema, type ProfileInput } from '@/lib/validations/profile'
import { updateProfile } from '@/lib/actions/profile'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Props = {
  defaultValues: ProfileInput
}

type ProfileFormValues = {
  name: string
  business_name: string
  phone?: string
  city?: string
  tax_id?: string
  commercial_registration?: string
  vat_registered?: boolean
  prefer_hijri?: boolean
}

export function ProfileForm({ defaultValues }: Props) {
  const t = useTranslations('ProfileForm')
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema) as unknown as Resolver<ProfileFormValues>,
    defaultValues,
  })

  const vatRegistered = watch('vat_registered')

  const onSubmit = handleSubmit(async (values) => {
    const res = await updateProfile(values)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('success'))
  })

  return (
    <form onSubmit={onSubmit} className="space-y-5 sm:space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="form-label">{t('fullName')}</label>
          <Input className="mt-1.5" {...register('name')} />
          {errors.name && <p className="mt-1.5 text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div>
          <label className="form-label">{t('businessName')}</label>
          <Input className="mt-1.5" {...register('business_name')} />
          {errors.business_name && (
            <p className="mt-1.5 text-sm text-destructive">{errors.business_name.message}</p>
          )}
        </div>

        <div>
          <label className="form-label">{t('phone')}</label>
          <Input className="mt-1.5" autoComplete="tel" {...register('phone')} />
          {errors.phone && <p className="mt-1.5 text-sm text-destructive">{errors.phone.message}</p>}
        </div>

        <div>
          <label className="form-label">{t('city')}</label>
          <Input className="mt-1.5" autoComplete="address-level2" {...register('city')} />
          {errors.city && <p className="mt-1.5 text-sm text-destructive">{errors.city.message}</p>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">{t('legalSection')}</span>
          <span className="text-xs text-muted-foreground">{t('legalSectionHint')}</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="form-label">{t('taxId')}</label>
            <Input
              className="mt-1.5"
              inputMode="numeric"
              placeholder="123456789"
              {...register('tax_id')}
            />
          </div>
          <div>
            <label className="form-label">{t('commercialRegistration')}</label>
            <Input className="mt-1.5" placeholder="CR-…" {...register('commercial_registration')} />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
              {...register('vat_registered')}
            />
            <span>
              <span className="font-medium text-foreground">{t('vatRegistered')}</span>
              <span className="ms-1 text-xs text-muted-foreground">{t('vatRegisteredHint')}</span>
            </span>
          </label>
          {vatRegistered ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {t('vatTaxIdRequired')}
            </p>
          ) : null}
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
              {...register('prefer_hijri')}
            />
            <span>
              <span className="font-medium text-foreground">{t('preferHijri')}</span>
              <span className="ms-1 text-xs text-muted-foreground">{t('preferHijriHint')}</span>
            </span>
          </label>
        </div>
      </div>

      <div className="pt-1">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  )
}
