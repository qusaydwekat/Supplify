'use client'

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createInvoiceFromOrder } from '@/lib/actions/invoices'
import { createInvoiceFromOrderSchema, type CreateInvoiceFromOrderInput } from '@/lib/validations/invoice'
import { formatDateShort, normalizeAppLocale } from '@/lib/format-datetime'
import { formatMoney } from '@/lib/format-money'
import type { DeliveredOrderOption } from '@/lib/invoices-types'

type Props = {
  orders: DeliveredOrderOption[]
  defaultOrderId: string | null
}

export function NewInvoiceForm({ orders, defaultOrderId }: Props) {
  const t = useTranslations('NewInvoiceForm')
  const locale = normalizeAppLocale(useLocale())
  const router = useRouter()
  const [pending, start] = useTransition()
  const initialOrderId =
    defaultOrderId && orders.some((o) => o.id === defaultOrderId) ? defaultOrderId : (orders[0]?.id ?? '')
  const initialDue =
    orders.find((o) => o.id === initialOrderId)?.default_due_days ?? orders[0]?.default_due_days ?? 14

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<CreateInvoiceFromOrderInput>({
    resolver: zodResolver(createInvoiceFromOrderSchema) as Resolver<CreateInvoiceFromOrderInput>,
    defaultValues: {
      orderId: initialOrderId,
      notes: '',
      dueInDays: initialDue,
    },
  })

  const watchedOrderId = useWatch({ control, name: 'orderId' })
  useEffect(() => {
    const row = orders.find((o) => o.id === watchedOrderId)
    if (row) setValue('dueInDays', row.default_due_days)
  }, [watchedOrderId, orders, setValue])

  function onSubmit(values: CreateInvoiceFromOrderInput) {
    start(async () => {
      const r = await createInvoiceFromOrder(values)
      if (r.error) toast.error(r.error)
      else if (r.invoiceId) {
        toast.success(t('success'))
        router.push(`/supplier/invoices/${r.invoiceId}`)
      }
    })
  }

  if (!orders.length) {
    return <p className="text-sm text-slate-600">{t('empty')}</p>
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-4">
      <label className="block text-sm text-slate-700">
        {t('order')}
        <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" {...register('orderId')}>
          {orders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.retailerLabel} — {formatDateShort(o.created_at, locale)} —{' '}
              {formatMoney(o.total_price, o.supplier_currency)}
            </option>
          ))}
        </select>
        {errors.orderId ? <span className="text-xs text-red-600">{errors.orderId.message}</span> : null}
      </label>
      <label className="block text-sm text-slate-700">
        {t('dueInDays')}
        <input
          type="number"
          min={1}
          max={365}
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          {...register('dueInDays')}
        />
        {errors.dueInDays ? <span className="text-xs text-red-600">{errors.dueInDays.message}</span> : null}
      </label>
      <label className="block text-sm text-slate-700">
        {t('notesOptional')}
        <textarea rows={3} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" {...register('notes')} />
      </label>
      <Button type="submit" disabled={pending}>
        {t('createInvoice')}
      </Button>
    </form>
  )
}
