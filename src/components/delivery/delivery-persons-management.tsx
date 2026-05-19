'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { DeliveryPersonRow } from '@/lib/actions/delivery-persons'
import { DeliveryPersonCard } from '@/components/delivery/delivery-person-card'
import { DeliveryPersonForm } from '@/components/delivery/delivery-person-form'

export function DeliveryPersonsManagement({ initialRows }: { initialRows: DeliveryPersonRow[] }) {
  const t = useTranslations('DeliveryPersonsPage')
  const router = useRouter()
  const [rows, setRows] = useState(initialRows)
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    setRows(initialRows)
  }, [initialRows])

  function refresh() {
    router.refresh()
  }

  const active = rows.filter((r) => r.is_active)
  const inactive = rows.filter((r) => !r.is_active)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('subtitle')}</p>
        </div>
        <Button type="button" onClick={() => setAddOpen(true)}>
          {t('addPerson')}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
          <p className="text-4xl">🚚</p>
          <p className="mt-3 text-sm font-medium text-slate-900">{t('emptyTitle')}</p>
          <p className="mt-1 text-sm text-slate-600">{t('emptyHint')}</p>
          <Button type="button" className="mt-4" onClick={() => setAddOpen(true)}>
            {t('addFirst')}
          </Button>
        </div>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-800">
              {t('sectionActive', { count: active.length })}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((p) => (
                <DeliveryPersonCard key={p.id} person={p} onChanged={refresh} />
              ))}
            </div>
          </section>
          {inactive.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-slate-500">
                {t('sectionInactive', { count: inactive.length })}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {inactive.map((p) => (
                  <DeliveryPersonCard key={p.id} person={p} onChanged={refresh} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      {addOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-900">{t('addDialogTitle')}</h3>
            <div className="mt-3">
              <DeliveryPersonForm
                onSuccess={() => {
                  setAddOpen(false)
                  refresh()
                }}
                onCancel={() => setAddOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
