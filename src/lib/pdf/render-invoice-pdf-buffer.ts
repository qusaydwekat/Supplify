import 'server-only'

import React from 'react'
import { ensurePdfFonts } from '@/lib/pdf/ensure-pdf-fonts'
import type { InvoicePdfProps } from '@/lib/pdf/invoice-document'

/** Renders invoice PDF bytes (fonts + react-pdf in one module for Next.js). */
export async function renderInvoicePdfBuffer(props: InvoicePdfProps): Promise<Uint8Array> {
  await ensurePdfFonts()

  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { InvoicePdfDocument } = await import('@/lib/pdf/invoice-document')

  const element = React.createElement(InvoicePdfDocument, props)
  const buf = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0])
  return new Uint8Array(buf)
}
