import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { defaultLocale, isAppLocale, localeCookieName, type AppLocale } from '@/i18n/routing'
import { getInvoicePdfPayload } from '@/lib/data/invoice-pdf'
import { loadInvoicePdfLabels } from '@/lib/pdf/invoice-pdf-i18n'
import { renderInvoicePdfBuffer } from '@/lib/pdf/render-invoice-pdf-buffer'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await getInvoicePdfPayload(id)

  if ('error' in res) {
    const status =
      res.error === 'Unauthorized'
        ? 401
        : res.error === 'Forbidden'
          ? 403
          : res.error === 'Invoice not found'
            ? 404
            : 400
    return NextResponse.json({ error: res.error }, { status })
  }

  const raw = (await cookies()).get(localeCookieName)?.value
  const locale: AppLocale = isAppLocale(raw) ? raw : defaultLocale
  const labels = await loadInvoicePdfLabels(locale)
  const p = res.payload

  try {
    const buf = await renderInvoicePdfBuffer({ locale, labels, ...p })

    const safeName = p.invoiceNumber.replace(/[^\w.-]+/g, '_') || 'invoice'
    return new NextResponse(Buffer.from(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[invoice-pdf]', id, message, err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
