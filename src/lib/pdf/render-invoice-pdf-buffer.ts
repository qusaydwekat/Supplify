import 'server-only'

import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import type { InvoicePdfProps } from '@/lib/pdf/invoice-document'

const FONT_FAMILY = 'SupplifyPdf'

let fontsReady: Promise<void> | null = null

function fontFileToDataUrl(filename: string): string {
  const filePath = path.join(process.cwd(), 'public', 'fonts', filename)
  const bytes = fs.readFileSync(filePath)
  return `data:font/ttf;base64,${bytes.toString('base64')}`
}

async function ensureInvoicePdfFonts(): Promise<void> {
  if (!fontsReady) {
    fontsReady = (async () => {
      const { Font } = await import('@react-pdf/renderer')

      Font.registerHyphenationCallback((word) => [word])
      Font.register({
        family: FONT_FAMILY,
        fonts: [
          { src: fontFileToDataUrl('NotoSansArabic-Regular.ttf'), fontWeight: 400 },
          { src: fontFileToDataUrl('NotoSansArabic-Bold.ttf'), fontWeight: 700 },
        ],
      })

      await Promise.all([
        Font.load({ fontFamily: FONT_FAMILY, fontWeight: 400 }),
        Font.load({ fontFamily: FONT_FAMILY, fontWeight: 700 }),
      ])
    })().catch((err) => {
      fontsReady = null
      throw err
    })
  }

  return fontsReady
}

/** Renders invoice PDF bytes (fonts + react-pdf in one module for Next.js). */
export async function renderInvoicePdfBuffer(props: InvoicePdfProps): Promise<Uint8Array> {
  await ensureInvoicePdfFonts()

  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { InvoicePdfDocument } = await import('@/lib/pdf/invoice-document')

  const element = React.createElement(InvoicePdfDocument, props)
  const buf = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0])
  return new Uint8Array(buf)
}
