'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

type Props = {
  invoiceId: string
  invoiceNumber: string
  className?: string
  children: React.ReactNode
}

export function InvoicePdfDownloadButton({ invoiceId, invoiceNumber, className, children }: Props) {
  const t = useTranslations('InvoiceDetailPage')
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`, { credentials: 'same-origin' })
      if (!res.ok) {
        let message = t('pdfDownloadFailed')
        try {
          const body = (await res.json()) as { error?: string }
          if (body.error) message = body.error
        } catch {
          /* non-JSON error body */
        }
        window.alert(message)
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${invoiceNumber.replace(/[^\w.-]+/g, '_') || 'invoice'}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch {
      window.alert(t('pdfDownloadFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={loading}
      className={className}
      aria-busy={loading}
    >
      {loading ? t('pdfDownloading') : children}
    </button>
  )
}
