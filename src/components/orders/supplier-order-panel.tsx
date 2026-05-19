'use client'

import { useMemo, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  acceptOrder,
  advanceOrderStatus,
  modifyOrder,
  rejectOrder,
} from '@/lib/actions/orders'
import { DeliveryPersonShipDialog } from '@/components/delivery/delivery-person-ship-dialog'
import type { OrderItemRow } from '@/lib/data/orders'
import type { OrderStatus } from '@/lib/validations/order'

type Props = {
  orderId: string
  status: OrderStatus
  items: OrderItemRow[]
}

type ToastKey =
  | 'toastAccepted'
  | 'toastRejected'
  | 'toastUpdated'
  | 'toastStatusUpdated'
  | 'toastMarkedDelivered'

export function SupplierOrderPanel({ orderId, status, items }: Props) {
  const t = useTranslations('SupplierOrderPanel')
  const tErr = useTranslations('Errors')
  const [pending, start] = useTransition()
  const [shipOpen, setShipOpen] = useState(false)
  const [showModify, setShowModify] = useState(false)
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(items.map((i) => [i.id, { quantity: i.quantity, unitPrice: i.unit_price }])),
  )

  const linePayload = useMemo(
    () =>
      items.map((i) => ({
        orderItemId: i.id,
        quantity: draft[i.id]?.quantity ?? i.quantity,
        unitPrice: draft[i.id]?.unitPrice ?? i.unit_price,
      })),
    [items, draft],
  )

  function run(
    label: ToastKey,
    fn: () => Promise<{ error: string | null; errorKey?: string | null; errorParams?: Record<string, string | number> | null }>,
  ) {
    start(async () => {
      const r = await fn()
      if (r.error) {
        if (r.errorKey) toast.error(tErr(r.errorKey, r.errorParams ?? undefined))
        else toast.error(r.error)
      }
      else toast.success(t(label))
    })
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t('actions')}</h2>

      {status === 'pending' && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending} onClick={() => run('toastAccepted', () => acceptOrder(orderId))}>
            {t('accept')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => run('toastRejected', () => rejectOrder(orderId))}
          >
            {t('reject')}
          </Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setShowModify((s) => !s)}>
            {showModify ? t('hideAdjustments') : t('adjustOrder')}
          </Button>
        </div>
      )}

      {status === 'pending' && showModify && (
        <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-600">{t('modifyHint')}</p>
          <div className="space-y-2">
            {items.map((i) => (
              <div key={i.id} className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <span className="text-sm text-slate-800">
                  {i.product_name}
                  {i.variation_name ? ` — ${i.variation_name}` : ''}
                </span>
                <label className="flex items-center gap-1 text-xs text-slate-600">
                  {t('qty')}
                  <input
                    type="number"
                    min={1}
                    className="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
                    value={draft[i.id]?.quantity ?? i.quantity}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        [i.id]: { ...d[i.id], quantity: Number(e.target.value), unitPrice: d[i.id]?.unitPrice ?? i.unit_price },
                      }))
                    }
                  />
                </label>
                <label className="flex items-center gap-1 text-xs text-slate-600">
                  {t('unit')}
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-24 rounded border border-slate-200 px-2 py-1 text-sm"
                    value={draft[i.id]?.unitPrice ?? i.unit_price}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        [i.id]: {
                          quantity: d[i.id]?.quantity ?? i.quantity,
                          unitPrice: Number(e.target.value),
                        },
                      }))
                    }
                  />
                </label>
              </div>
            ))}
          </div>
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              run('toastUpdated', () =>
                modifyOrder({
                  orderId,
                  lines: linePayload,
                }),
              )
            }
          >
            {t('saveChangesModified')}
          </Button>
        </div>
      )}

      {status === 'accepted' && (
        <Button
          type="button"
          disabled={pending}
          onClick={() => run('toastStatusUpdated', () => advanceOrderStatus(orderId, 'preparing'))}
        >
          {t('startPreparing')}
        </Button>
      )}

      {status === 'preparing' && (
        <>
          <Button type="button" disabled={pending} onClick={() => setShipOpen(true)}>
            {t('markShipped')}
          </Button>
          <DeliveryPersonShipDialog
            orderId={orderId}
            mode="ship"
            open={shipOpen}
            onClose={() => setShipOpen(false)}
          />
        </>
      )}

      {status === 'shipped' && (
        <Button
          type="button"
          disabled={pending}
          onClick={() => run('toastMarkedDelivered', () => advanceOrderStatus(orderId, 'delivered'))}
        >
          {t('markDelivered')}
        </Button>
      )}

      {status === 'modified' && <p className="text-xs text-slate-600">{t('waitingRetailer')}</p>}

      {['rejected', 'delivered', 'cancelled'].includes(status) && (
        <p className="text-xs text-slate-500">{t('noFurtherActions')}</p>
      )}
    </div>
  )
}
