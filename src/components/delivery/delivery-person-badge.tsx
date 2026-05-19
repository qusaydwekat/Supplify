'use client'

import { useTranslations } from 'next-intl'

function digitsOnly(phone: string) {
  return phone.replace(/[^0-9]/g, '')
}

type Props = {
  name: string
  phone: string
}

export function DeliveryPersonBadge({ name, phone }: Props) {
  const t = useTranslations('DeliveryPersonBadge')
  const wa = digitsOnly(phone)

  return (
    <section className="rounded-lg border border-indigo-200 bg-indigo-50/80 p-4">
      <h2 className="text-sm font-semibold text-indigo-950">{t('title')}</h2>
      <div className="mt-3 space-y-1 text-sm">
        <p className="font-medium text-slate-900">👤 {name}</p>
        <p className="text-slate-700">📞 {phone}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={`tel:${phone}`}
          className="inline-flex h-9 items-center rounded-md border border-indigo-300 bg-white px-3 text-sm font-medium text-indigo-900 hover:bg-indigo-100"
        >
          {t('call')}
        </a>
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center rounded-md border border-indigo-300 bg-white px-3 text-sm font-medium text-indigo-900 hover:bg-indigo-100"
        >
          {t('whatsapp')}
        </a>
      </div>
    </section>
  )
}
