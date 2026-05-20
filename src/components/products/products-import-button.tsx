'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { importProductsCsv } from '@/lib/actions/products-catalog'
import { Button } from '@/components/ui/button'

type Props = {
  exportHref: string
}

export function ProductsImportButton({ exportHref }: Props) {
  const t = useTranslations('ProductCatalog')
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function onFile(file: File) {
    setPending(true)
    const text = await file.text()
    const res = await importProductsCsv(text)
    setPending(false)
    setOpen(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(
      t('importSuccess', {
        created: res.created,
        updated: res.updated,
        skipped: res.skipped,
      }),
    )
    router.refresh()
  }

  return (
    <>
      <Button type="button" className="h-9 min-h-9 px-3 text-sm" variant="secondary" onClick={() => setOpen(true)}>
        {t('importCsv')}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">{t('importTitle')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t('importHint')}</p>
            <a
              href={exportHref}
              className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('importDownloadTemplate')}
            </a>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="mt-4 block w-full text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void onFile(file)
                e.target.value = ''
              }}
            />
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
                {t('importCancel')}
              </Button>
              <Button type="button" disabled={pending} onClick={() => inputRef.current?.click()}>
                {pending ? t('importRunning') : t('importChooseFile')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
