import 'server-only'

import fs from 'node:fs'
import path from 'node:path'
import type { LedgerListRow } from '@/lib/data/ledger'
import { formatLabel } from '@/lib/pdf/invoice-pdf-i18n'
import { ledgerTypeLabel } from '@/lib/pdf/ledger-statement-pdf-i18n'
import type { LedgerStatementPdfProps } from '@/lib/pdf/ledger-statement-types'
import { formatPdfCurrencyCode, formatPdfDate, formatPdfMoney, pdfLtrTextStyle } from '@/lib/pdf/pdf-format'
import { pdfSafeText } from '@/lib/pdf/pdf-safe-text'

export type { LedgerStatementPdfProps } from '@/lib/pdf/ledger-statement-types'

const PDF_FONT_FAMILY = 'SupplifyPdf'
const ROWS_PER_PAGE = 26

const c = {
  primary: '#0f766e',
  primaryDark: '#115e59',
  ink: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  surface: '#f8fafc',
  white: '#ffffff',
  danger: '#b91c1c',
  success: '#047857',
}

function fontFileToDataUrl(filename: string): string {
  const filePath = path.join(process.cwd(), 'public', 'fonts', filename)
  const bytes = fs.readFileSync(filePath)
  return `data:font/ttf;base64,${bytes.toString('base64')}`
}

async function loadPdfFonts(Font: typeof import('@react-pdf/renderer').Font): Promise<void> {
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
    // already registered
  }

  await Promise.all([
    Font.load({ fontFamily: PDF_FONT_FAMILY, fontWeight: 400 }),
    Font.load({ fontFamily: PDF_FONT_FAMILY, fontWeight: 700 }),
  ])
}

function chunkRows(rows: LedgerListRow[], size: number): LedgerListRow[][] {
  if (rows.length === 0) return [[]]
  const chunks: LedgerListRow[][] = []
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size))
  }
  return chunks
}

function isMostlyLatin(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  const latin = trimmed.replace(/[^\u0000-\u007F]/g, '').length
  return latin / trimmed.length >= 0.6
}

function buildDocument(props: LedgerStatementPdfProps, pdf: typeof import('@react-pdf/renderer')) {
  const { Document, Page, Text, View, StyleSheet } = pdf
  const {
    locale,
    labels,
    supplierName,
    retailerName,
    currencyCode,
    periodFrom,
    periodTo,
    generatedAt,
    totalInvoiced,
    totalCollected,
    netBalance,
    rows,
  } = props

  const rtl = locale === 'ar'
  const tableChunks = chunkRows(rows, ROWS_PER_PAGE)
  const firstChunk = tableChunks[0] ?? []
  const extraChunks = tableChunks.slice(1)

  const styles = StyleSheet.create({
    page: {
      paddingTop: 36,
      paddingBottom: 36,
      paddingHorizontal: 40,
      fontSize: 9,
      fontFamily: PDF_FONT_FAMILY,
      color: c.ink,
      backgroundColor: c.white,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
      borderBottomWidth: 3,
      borderBottomColor: c.primary,
      paddingBottom: 12,
    },
    headerMain: { flex: 1, paddingRight: 12 },
    headerBrand: { fontSize: 8.5, color: c.primary, fontWeight: 700, marginBottom: 4 },
    headerTitle: { fontSize: 18, fontWeight: 700, color: c.ink },
    headerSub: { fontSize: 8.5, color: c.muted, marginTop: 4 },
    headerAside: { width: 110, alignItems: 'flex-end' },
    asideLabel: { fontSize: 7.5, color: c.muted, marginBottom: 3 },
    asideValue: { fontSize: 9.5, fontWeight: 700, color: c.ink },
    partiesRow: { flexDirection: 'row', marginBottom: 12 },
    partyCard: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      padding: 10,
      backgroundColor: c.surface,
    },
    partyCardLeft: { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 },
    partyCardRight: { borderTopRightRadius: 6, borderBottomRightRadius: 6, borderLeftWidth: 0 },
    partyLabel: {
      fontSize: 7,
      fontWeight: 700,
      color: c.muted,
      marginBottom: 5,
      paddingBottom: 3,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    partyName: { fontSize: 10, fontWeight: 700 },
    metaGrid: { flexDirection: 'row', borderWidth: 1, borderColor: c.border, marginBottom: 14 },
    metaCell: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRightWidth: 1,
      borderRightColor: c.border,
    },
    metaCellLast: { borderRightWidth: 0 },
    metaLabel: { fontSize: 7, color: c.muted, marginBottom: 3 },
    metaValue: { fontSize: 9, fontWeight: 700, color: c.ink },
    summaryWrap: { flexDirection: 'row', marginBottom: 14 },
    summarySpacer: { flex: 1 },
    summaryPanel: { width: 240, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface },
    summaryHead: { backgroundColor: c.primaryDark, paddingVertical: 7, paddingHorizontal: 10 },
    summaryHeadText: { fontSize: 8, fontWeight: 700, color: c.white },
    summaryBody: { paddingVertical: 8, paddingHorizontal: 10 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    summaryLabel: { fontSize: 8.5, color: c.muted, flex: 1, paddingRight: 6 },
    summaryValue: { fontSize: 9, fontWeight: 700, width: 90, textAlign: 'right' },
    summaryDivider: { borderTopWidth: 1, borderTopColor: c.borderStrong, marginVertical: 6 },
    balanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 4,
      paddingVertical: 7,
      paddingHorizontal: 8,
      backgroundColor: c.white,
    },
    balanceLabel: { fontSize: 9, fontWeight: 700 },
    balanceValue: { fontSize: 11, fontWeight: 700, color: c.danger },
    sectionTitle: { fontSize: 8, fontWeight: 700, color: c.primaryDark, marginBottom: 6 },
    table: { borderWidth: 1, borderColor: c.borderStrong, marginBottom: 10 },
    tableHead: {
      flexDirection: 'row',
      backgroundColor: c.primaryDark,
      paddingVertical: 8,
      paddingHorizontal: 6,
    },
    th: { color: c.white, fontSize: 7, fontWeight: 700 },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 7,
      paddingHorizontal: 6,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      alignItems: 'flex-start',
    },
    tableRowAlt: { backgroundColor: c.surface },
    tableRowLast: { borderBottomWidth: 0 },
    colDate: { width: '15%' },
    colType: { width: '11%' },
    colParty: { width: '16%' },
    colDesc: { width: '29%' },
    colAmount: { width: '14%', textAlign: 'right' },
    colBalance: { width: '15%', textAlign: 'right' },
    colDateRtl: { textAlign: 'right' },
    colTypeRtl: { textAlign: 'right' },
    colPartyRtl: { textAlign: 'right' },
    colDescRtl: { textAlign: 'right' },
    colNumRtl: { textAlign: 'left', paddingHorizontal: 2 },
    thRtl: { textAlign: 'right' },
    thNumRtl: { textAlign: 'left', paddingHorizontal: 2 },
    cellText: { fontSize: 8, lineHeight: 1.3, color: c.ink },
    cellMuted: { fontSize: 7.5, lineHeight: 1.3, color: c.muted },
    footer: { marginTop: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8, alignItems: 'center' },
    footerThanks: { fontSize: 8, color: c.primary, fontWeight: 700, marginBottom: 3, textAlign: 'center' },
    footerText: { fontSize: 7, color: c.muted, lineHeight: 1.4, textAlign: 'center' },
  })

  const txtAlign = rtl ? { textAlign: 'right' as const } : {}
  const rowDir = rtl ? ('row-reverse' as const) : ('row' as const)

  const thDate = [styles.colDate, styles.th, rtl ? styles.thRtl : {}]
  const thType = [styles.colType, styles.th, rtl ? styles.thRtl : {}]
  const thParty = [styles.colParty, styles.th, rtl ? styles.thRtl : {}]
  const thDesc = [styles.colDesc, styles.th, rtl ? styles.thRtl : {}]
  const thAmount = [styles.colAmount, styles.th, rtl ? styles.thNumRtl : {}]
  const thBalance = [styles.colBalance, styles.th, rtl ? styles.thNumRtl : {}]

  function periodValue() {
    const baseStyle = [styles.metaValue, txtAlign]
    if (periodFrom && periodTo) {
      if (rtl) {
        return (
          <Text style={baseStyle}>
            {'من '}
            <Text style={pdfLtrTextStyle}>{periodFrom}</Text>
            {' إلى '}
            <Text style={pdfLtrTextStyle}>{periodTo}</Text>
          </Text>
        )
      }
      return <Text style={baseStyle}>{formatLabel(labels.periodFromTo, { from: periodFrom, to: periodTo })}</Text>
    }
    if (periodFrom) {
      if (rtl) {
        return (
          <Text style={baseStyle}>
            {'من '}
            <Text style={pdfLtrTextStyle}>{periodFrom}</Text>
          </Text>
        )
      }
      return <Text style={baseStyle}>{formatLabel(labels.periodFrom, { from: periodFrom })}</Text>
    }
    if (periodTo) {
      if (rtl) {
        return (
          <Text style={baseStyle}>
            {'حتى '}
            <Text style={pdfLtrTextStyle}>{periodTo}</Text>
          </Text>
        )
      }
      return <Text style={baseStyle}>{formatLabel(labels.periodTo, { to: periodTo })}</Text>
    }
    return <Text style={baseStyle}>{labels.periodAll}</Text>
  }

  function footerBlock() {
    return (
      <View style={styles.footer}>
        <Text style={[styles.footerThanks, { textAlign: 'center' }]}>{labels.footerThanks}</Text>
        {rtl ? (
          <Text style={[styles.footerText, { textAlign: 'center' }]}>
            {'تم إصدار هذا الكشف عبر منصة '}
            <Text style={pdfLtrTextStyle}>Supplify</Text>
            {' · يعكس الأرصدة الجارية في دفتر الحسابات'}
          </Text>
        ) : (
          <Text style={styles.footerText}>{labels.footerRef}</Text>
        )}
      </View>
    )
  }

  function tableHeadRow() {
    return (
      <View style={[styles.tableHead, { flexDirection: rowDir }]}>
        <Text style={thDate}>{labels.colDate}</Text>
        <Text style={thType}>{labels.colType}</Text>
        <Text style={thParty}>{labels.colParty}</Text>
        <Text style={thDesc}>{labels.colDescription}</Text>
        <Text style={thAmount}>{labels.colAmount}</Text>
        <Text style={thBalance}>{labels.colBalance}</Text>
      </View>
    )
  }

  function tableBodyRows(chunk: LedgerListRow[]) {
    if (chunk.length === 0) {
      return (
        <View style={[styles.tableRow, { flexDirection: rowDir }]}>
          <Text style={[styles.cellMuted, { width: '100%', textAlign: 'center' }]}>-</Text>
        </View>
      )
    }

    return chunk.map((r, i) => {
      const counterpart = pdfSafeText(r.counterpart)
      const description = pdfSafeText(r.description)
      const counterpartStyle = isMostlyLatin(counterpart)
        ? [styles.colParty, styles.cellText, pdfLtrTextStyle]
        : [styles.colParty, styles.cellText, rtl ? styles.colPartyRtl : {}, txtAlign]
      const descriptionStyle = isMostlyLatin(description)
        ? [styles.colDesc, styles.cellMuted, pdfLtrTextStyle]
        : [styles.colDesc, styles.cellMuted, rtl ? styles.colDescRtl : {}, txtAlign]

      return (
        <View
          key={r.id || String(i)}
          style={[
            styles.tableRow,
            { flexDirection: rowDir },
            i % 2 === 1 ? styles.tableRowAlt : {},
            i === chunk.length - 1 ? styles.tableRowLast : {},
          ]}
        >
          <Text style={[styles.colDate, styles.cellText, rtl ? styles.colDateRtl : {}, pdfLtrTextStyle]}>
            {formatPdfDate(r.created_at, locale).replace(/\u2014/g, '-')}
          </Text>
          <Text style={[styles.colType, styles.cellText, rtl ? styles.colTypeRtl : {}, txtAlign]}>
            {ledgerTypeLabel(labels, r.type)}
          </Text>
          <Text style={counterpartStyle}>{counterpart}</Text>
          <Text style={descriptionStyle}>{description}</Text>
          <Text style={[styles.colAmount, styles.cellText, rtl ? styles.colNumRtl : {}, pdfLtrTextStyle]}>
            {formatPdfMoney(Number(r.amount) || 0, currencyCode, locale)}
          </Text>
          <Text style={[styles.colBalance, styles.cellText, rtl ? styles.colNumRtl : {}, pdfLtrTextStyle]}>
            {formatPdfMoney(Number(r.runningBalance) || 0, currencyCode, locale)}
          </Text>
        </View>
      )
    })
  }

  const supplierStyle = isMostlyLatin(pdfSafeText(supplierName))
    ? [styles.partyName, pdfLtrTextStyle]
    : [styles.partyName, txtAlign]
  const retailerDisplay = pdfSafeText(retailerName ?? labels.allRetailers)
  const retailerStyle = isMostlyLatin(retailerDisplay)
    ? [styles.partyName, retailerName ? {} : { color: c.muted }, pdfLtrTextStyle]
    : [styles.partyName, retailerName ? {} : { color: c.muted }, txtAlign]

  return (
    <Document title={pdfSafeText(labels.documentTitle)}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={[styles.headerMain, rtl ? { alignItems: 'flex-end' } : {}]}>
            <Text style={[styles.headerBrand, pdfLtrTextStyle]}>{labels.brand}</Text>
            <Text style={[styles.headerTitle, txtAlign]}>{labels.headerTitle}</Text>
            <Text style={[styles.headerSub, txtAlign]}>{labels.headerSub}</Text>
          </View>
          <View style={[styles.headerAside, rtl ? { alignItems: 'flex-start' } : {}]}>
            <Text style={[styles.asideLabel, rtl ? { textAlign: 'left' } : {}]}>{labels.generated}</Text>
            <Text style={[styles.asideValue, pdfLtrTextStyle]}>{generatedAt}</Text>
          </View>
        </View>

        <View style={styles.partiesRow}>
          <View style={[styles.partyCard, styles.partyCardLeft]}>
            <Text style={[styles.partyLabel, txtAlign]}>{labels.supplier}</Text>
            <Text style={supplierStyle}>{pdfSafeText(supplierName)}</Text>
          </View>
          <View style={[styles.partyCard, styles.partyCardRight]}>
            <Text style={[styles.partyLabel, txtAlign]}>{labels.retailer}</Text>
            <Text style={retailerStyle}>{retailerDisplay}</Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCell}>
            <Text style={[styles.metaLabel, txtAlign]}>{labels.periodLabel}</Text>
            {periodValue()}
          </View>
          <View style={[styles.metaCell, styles.metaCellLast]}>
            <Text style={[styles.metaLabel, txtAlign]}>{labels.currency}</Text>
            <Text style={[styles.metaValue, pdfLtrTextStyle]}>{formatPdfCurrencyCode(currencyCode)}</Text>
          </View>
        </View>

        <View style={styles.summaryWrap}>
          <View style={styles.summarySpacer} />
          <View style={styles.summaryPanel}>
            <View style={styles.summaryHead}>
              <Text style={[styles.summaryHeadText, txtAlign]}>{labels.summaryTitle}</Text>
            </View>
            <View style={styles.summaryBody}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, txtAlign]}>{labels.totalInvoiced}</Text>
                <Text style={[styles.summaryValue, pdfLtrTextStyle]}>
                  {formatPdfMoney(totalInvoiced, currencyCode, locale)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, txtAlign]}>{labels.totalCollected}</Text>
                <Text style={[styles.summaryValue, pdfLtrTextStyle]}>
                  {formatPdfMoney(totalCollected, currencyCode, locale)}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.balanceRow}>
                <Text style={[styles.balanceLabel, txtAlign]}>{labels.outstanding}</Text>
                <Text style={[styles.balanceValue, netBalance <= 0 ? { color: c.success } : {}, pdfLtrTextStyle]}>
                  {formatPdfMoney(netBalance, currencyCode, locale)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={[styles.sectionTitle, txtAlign]}>{labels.transactions}</Text>
        <View style={styles.table}>
          {tableHeadRow()}
          {tableBodyRows(firstChunk)}
        </View>

        {extraChunks.length === 0 ? footerBlock() : null}
      </Page>

      {extraChunks.map((chunk, pageIndex) => (
        <Page key={`p-${pageIndex + 1}`} size="A4" style={styles.page}>
          <Text style={[styles.sectionTitle, txtAlign]}>{labels.transactions}</Text>
          <View style={styles.table}>
            {tableHeadRow()}
            {tableBodyRows(chunk)}
          </View>
          {pageIndex === extraChunks.length - 1 ? footerBlock() : null}
        </Page>
      ))}
    </Document>
  )
}

export async function renderLedgerStatementPdfBuffer(
  props: LedgerStatementPdfProps,
): Promise<Uint8Array> {
  const pdf = await import('@react-pdf/renderer')
  await loadPdfFonts(pdf.Font)

  const element = buildDocument(props, pdf)
  const buf = await pdf.renderToBuffer(element as Parameters<typeof pdf.renderToBuffer>[0])
  return new Uint8Array(buf)
}
