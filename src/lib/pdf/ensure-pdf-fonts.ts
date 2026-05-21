import fs from 'node:fs'
import path from 'node:path'

export const PDF_FONT_FAMILY = 'SupplifyPdf'

let fontsReady: Promise<void> | null = null

function fontFileToDataUrl(filename: string): string {
  const filePath = path.join(process.cwd(), 'public', 'fonts', filename)
  const bytes = fs.readFileSync(filePath)
  return `data:font/ttf;base64,${bytes.toString('base64')}`
}

type PdfFontModule = typeof import('@react-pdf/renderer').Font

/** Registers Noto Sans Arabic for react-pdf (invoice, ledger statement, etc.). */
export async function ensurePdfFonts(fontModule?: PdfFontModule): Promise<void> {
  if (!fontsReady) {
    fontsReady = (async () => {
      const Font = fontModule ?? (await import('@react-pdf/renderer')).Font

      Font.registerHyphenationCallback((word) => [word])
      try {
        Font.register({
          family: PDF_FONT_FAMILY,
          fonts: [
            { src: fontFileToDataUrl('NotoSansArabic-Regular.ttf'), fontWeight: 400 },
            { src: fontFileToDataUrl('NotoSansArabic-Bold.ttf'), fontWeight: 700 },
          ],
        })
      } catch {
        // Already registered (e.g. after dev HMR)
      }

      await Promise.all([
        Font.load({ fontFamily: PDF_FONT_FAMILY, fontWeight: 400 }),
        Font.load({ fontFamily: PDF_FONT_FAMILY, fontWeight: 700 }),
      ])
    })().catch((err) => {
      fontsReady = null
      throw err
    })
  }

  return fontsReady
}
