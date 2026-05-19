import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { defaultLocale, isAppLocale, localeCookieName, type AppLocale } from '@/i18n/routing'
import { InvoicePdfDocument } from '@/lib/pdf/invoice-document'
import { getInvoiceForViewer } from '@/lib/data/invoices'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await getInvoiceForViewer(id)

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

  const inv = res.invoice

  const raw = (await cookies()).get(localeCookieName)?.value
  const pdfLocale: AppLocale = isAppLocale(raw) ? raw : defaultLocale

  const buf = await renderToBuffer(
    <InvoicePdfDocument
      invoiceNumber={inv.invoice_number}
      issuedAt={inv.issued_at}
      dueDate={inv.due_date}
      total={inv.total}
      currencyCode={inv.currency_code}
      counterpartyLabel={inv.counterparty}
      lines={inv.items.map((i) => ({
        product_name: i.product_name,
        variation_name: i.variation_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total_price: i.total_price,
      }))}
      notes={inv.notes}
      locale={pdfLocale}
    />,
  )

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${inv.invoice_number}.pdf"`,
    },
  })
}
