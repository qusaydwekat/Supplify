'use client'

import { Printer } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function LedgerPrintButton() {
  const t = useTranslations('LedgerPage')

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 print:hidden"
    >
      <Printer className="h-4 w-4" />
      {t('print')}
    </button>
  )
}
