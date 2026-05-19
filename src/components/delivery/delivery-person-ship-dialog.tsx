'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  getDeliveryPersons,
  markOrderShippedWithDeliveryPerson,
  reassignDeliveryPerson,
} from '@/lib/actions/delivery-persons'
import type { DeliveryPersonRow } from '@/lib/actions/delivery-persons'
import { DeliveryPersonForm } from '@/components/delivery/delivery-person-form'

type Mode = 'ship' | 'reassign'

type Props = {
  orderId: string
  mode: Mode
  open: boolean
  onClose: () => void
}

export function DeliveryPersonShipDialog({ orderId, mode, open, onClose }: Props) {
  const t = useTranslations('DeliveryShipDialog')
  const router = useRouter()
  const [pending, start] = useTransition()
  const [rows, setRows] = useState<DeliveryPersonRow[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    start(async () => {
      const r = await getDeliveryPersons(true)
      if (r.error) toast.error(r.error)
      else setRows(r.data ?? [])
      setSelectedId(null)
      setSearch('')
    })
  }, [open])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.phone.toLowerCase().includes(q))
  }, [rows, search])

  function onConfirm() {
    if (!selectedId) {
      toast.error(t('selectFirst'))
      return
    }
    start(async () => {
      const fn =
        mode === 'ship'
          ? markOrderShippedWithDeliveryPerson({ orderId, deliveryPersonId: selectedId })
          : reassignDeliveryPerson(orderId, selectedId)
      const r = await fn
      if ('error' in r && r.error) toast.error(r.error)
      else {
        toast.success(mode === 'ship' ? t('toastShipped') : t('toastReassigned'))
        onClose()
        router.refresh()
      }
    })
  }

  function afterCreatePerson(created?: DeliveryPersonRow | null) {
    setAddOpen(false)
    if (created?.id) setSelectedId(created.id)
    start(async () => {
      const r = await getDeliveryPersons(true)
      if (!r.error && r.data) setRows(r.data)
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{mode === 'ship' ? t('titleShip') : t('titleReassign')}</h2>
          <p className="mt-1 text-xs text-slate-600">{t('subtitle')}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <input
            type="search"
            placeholder={t('search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-3 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />

          {rows.length === 0 && !addOpen ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-center text-sm text-amber-950">
              <p>{t('empty')}</p>
              <Button type="button" variant="secondary" className="mt-3" onClick={() => setAddOpen(true)}>
                {t('addNew')}
              </Button>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((r) => (
                <li key={r.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                    <input
                      type="radio"
                      name="dp"
                      checked={selectedId === r.id}
                      onChange={() => setSelectedId(r.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium text-slate-900">{r.name}</span>
                      <span className="mt-0.5 block text-xs text-slate-600">📞 {r.phone}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {addOpen ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <p className="text-xs font-medium text-slate-800">{t('inlineAddTitle')}</p>
              <DeliveryPersonForm
                onSuccess={(created) => afterCreatePerson(created ?? undefined)}
                onCancel={() => setAddOpen(false)}
              />
            </div>
          ) : (
            <Button type="button" variant="ghost" className="mt-3 text-xs" onClick={() => setAddOpen(true)}>
              + {t('addNew')}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="button" disabled={pending || !selectedId} onClick={onConfirm}>
            {mode === 'ship' ? t('confirmShip') : t('confirmReassign')}
          </Button>
        </div>
      </div>
    </div>
  )
}
