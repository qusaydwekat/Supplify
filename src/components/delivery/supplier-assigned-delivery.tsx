'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { OrderStatus } from '@/lib/validations/order'
import { DeliveryPersonShipDialog } from '@/components/delivery/delivery-person-ship-dialog'
import { Button } from '@/components/ui/button'

export function SupplierAssignedDelivery(props: {
  orderId: string
  status: OrderStatus
  person: { id: string; name: string; phone: string } | null
}) {
  const { orderId, status, person } = props
  const t = useTranslations('SupplierAssignedDelivery')
  const [open, setOpen] = useState(false)

  if (status !== 'shipped' && status !== 'delivered') return null

  if (!person) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-950">
        <p>{t('missingContact')}</p>
      </section>
    )
  }

  return (
    <>
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">{t('title')}</h2>
        <p className="mt-2 text-sm font-medium text-slate-900">👤 {person.name}</p>
        <p className="text-sm text-slate-600">📞 {person.phone}</p>
        {status === 'shipped' ? (
          <Button type="button" variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
            {t('reassign')}
          </Button>
        ) : null}
      </section>
      <DeliveryPersonShipDialog orderId={orderId} mode="reassign" open={open} onClose={() => setOpen(false)} />
    </>
  )
}
