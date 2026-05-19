'use client'

import { useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createDeliveryPerson, updateDeliveryPerson } from '@/lib/actions/delivery-persons'
import type { DeliveryPersonRow } from '@/lib/actions/delivery-persons'
import { deliveryPersonSchema, type DeliveryPersonFormValues } from '@/lib/validations/delivery-person'

type Props = {
  person?: DeliveryPersonRow | null
  onSuccess: (created?: DeliveryPersonRow | null) => void
  onCancel: () => void
}

export function DeliveryPersonForm({ person, onSuccess, onCancel }: Props) {
  const t = useTranslations('DeliveryPersonForm')
  const [pending, start] = useTransition()
  const editMode = Boolean(person)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DeliveryPersonFormValues>({
    resolver: zodResolver(deliveryPersonSchema),
    defaultValues: {
      name: person?.name ?? '',
      phone: person?.phone ?? '',
      notes: person?.notes ?? '',
      is_active: person?.is_active ?? true,
    },
  })

  function onSubmit(values: DeliveryPersonFormValues) {
    start(async () => {
      const r = editMode
        ? await updateDeliveryPerson(person!.id, values)
        : await createDeliveryPerson(values)
      if (r.error) toast.error(r.error)
      else {
        toast.success(t('saved'))
        onSuccess(r.data ?? null)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <label className="block text-xs text-slate-600">
        {t('name')}
        <input
          type="text"
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          autoComplete="name"
          {...register('name')}
        />
        {errors.name ? <span className="text-red-600">{errors.name.message}</span> : null}
      </label>
      <label className="block text-xs text-slate-600">
        {t('phone')}
        <input
          type="tel"
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          {...register('phone')}
        />
        {errors.phone ? <span className="text-red-600">{errors.phone.message}</span> : null}
      </label>
      <label className="block text-xs text-slate-600">
        {t('notes')}
        <textarea
          rows={2}
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          {...register('notes')}
        />
        {errors.notes ? <span className="text-red-600">{errors.notes.message}</span> : null}
      </label>
      <label className="flex items-center gap-2 text-xs text-slate-700">
        <input type="checkbox" {...register('is_active')} />
        {t('active')}
      </label>
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={pending}>
          {editMode ? t('saveChanges') : t('add')}
        </Button>
      </div>
    </form>
  )
}
