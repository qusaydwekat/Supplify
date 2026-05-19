'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { DeliveryPersonRow } from '@/lib/actions/delivery-persons'
import { deleteDeliveryPerson, toggleDeliveryPersonActive } from '@/lib/actions/delivery-persons'
import { DeliveryPersonForm } from '@/components/delivery/delivery-person-form'

type Props = {
  person: DeliveryPersonRow
  onChanged: () => void
}

export function DeliveryPersonCard({ person, onChanged }: Props) {
  const t = useTranslations('DeliveryPersonCard')
  const [pending, start] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const dim = !person.is_active

  function onToggleActive() {
    start(async () => {
      const r = await toggleDeliveryPersonActive(person.id, !person.is_active)
      if (r.error) toast.error(r.error)
      else {
        toast.success(person.is_active ? t('deactivated') : t('activated'))
        onChanged()
      }
    })
  }

  function onDelete() {
    start(async () => {
      const r = await deleteDeliveryPerson(person.id)
      if (r.error) toast.error(r.error)
      else {
        toast.success(t('deleted'))
        setConfirmDelete(false)
        onChanged()
      }
    })
  }

  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${dim ? 'opacity-60' : ''}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">
            {person.name}
            {!person.is_active ? (
              <span className="ms-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                {t('inactiveBadge')}
              </span>
            ) : (
              <span className="ms-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                {t('activeBadge')}
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-slate-600">📞 {person.phone}</p>
          {person.notes ? <p className="mt-1 text-xs text-slate-500">📝 {person.notes}</p> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" className="min-h-8 px-3 py-1.5 text-xs" onClick={() => setEditOpen(true)}>
          {t('edit')}
        </Button>
        <Button type="button" variant="ghost" className="min-h-8 px-3 py-1.5 text-xs" disabled={pending} onClick={onToggleActive}>
          {person.is_active ? t('deactivate') : t('activate')}
        </Button>
        <Button type="button" variant="ghost" className="min-h-8 px-3 py-1.5 text-xs text-red-700" onClick={() => setConfirmDelete(true)}>
          {t('delete')}
        </Button>
      </div>

      {editOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-900">{t('editTitle')}</h3>
            <div className="mt-3">
              <DeliveryPersonForm
                person={person}
                onSuccess={() => {
                  setEditOpen(false)
                  onChanged()
                }}
                onCancel={() => setEditOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}

      {confirmDelete ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <p className="text-sm text-slate-800">{t('confirmDelete', { name: person.name })}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                {t('cancel')}
              </Button>
              <Button type="button" variant="secondary" className="text-red-700" disabled={pending} onClick={onDelete}>
                {t('deleteConfirm')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
