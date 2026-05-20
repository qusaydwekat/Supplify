import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { AppLocale } from '@/i18n/routing'
import type { InvoicePdfBank, InvoicePdfInstallment, InvoicePdfParty } from '@/lib/data/invoice-pdf'
import type { InvoiceStatus } from '@/lib/invoices-types'
import { formatLabel, pdfStatusLabel, type InvoicePdfLabels } from '@/lib/pdf/invoice-pdf-i18n'
import { formatLineItemLabel, formatPdfDate, formatPdfMoney } from '@/lib/pdf/pdf-format'
import { pdfFontFamily } from '@/lib/pdf/register-fonts'

export type InvoicePdfLine = {
  product_name: string
  variation_name: string | null
  quantity: number
  unit_price: number
  total_price: number
}

export type InvoicePdfProps = {
  locale: AppLocale
  labels: InvoicePdfLabels
  invoiceNumber: string
  status: InvoiceStatus
  issuedAt: string
  dueDate: string | null
  paidAt: string | null
  orderRef: string
  currencyCode: string
  supplier: InvoicePdfParty
  retailer: InvoicePdfParty
  lines: InvoicePdfLine[]
  notes: string | null
  total: number
  paidTotal: number
  remaining: number
  installments: InvoicePdfInstallment[]
  bank: InvoicePdfBank | null
}

const c = {
  primary: '#0f766e',
  primaryDark: '#115e59',
  primarySoft: '#ccfbf1',
  primaryMuted: '#99f6e4',
  ink: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  surface: '#f8fafc',
  white: '#ffffff',
  danger: '#b91c1c',
  dangerSoft: '#fef2f2',
  success: '#047857',
  successSoft: '#ecfdf5',
  warning: '#b45309',
  warningSoft: '#fffbeb',
}

const PAGE_PAD_H = 40
const PAGE_PAD_TOP = 36
const PAGE_PAD_BOTTOM = 52

const styles = StyleSheet.create({
  page: {
    paddingTop: PAGE_PAD_TOP,
    paddingBottom: PAGE_PAD_BOTTOM,
    paddingHorizontal: PAGE_PAD_H,
    fontSize: 9,
    fontFamily: pdfFontFamily,
    color: c.ink,
    backgroundColor: c.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    marginBottom: 20,
    borderBottomWidth: 3,
    borderBottomColor: c.primary,
    paddingBottom: 14,
  },
  headerMain: { flex: 1, justifyContent: 'center' },
  headerBrand: { fontSize: 8.5, color: c.primary, fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: 700, color: c.ink, lineHeight: 1.15 },
  headerSub: { fontSize: 8.5, color: c.muted, marginTop: 5, lineHeight: 1.4, maxWidth: 320 },
  headerAside: {
    minWidth: 168,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 16,
    borderLeftWidth: 1,
    borderLeftColor: c.border,
  },
  headerAsideRtl: {
    paddingLeft: 0,
    paddingRight: 16,
    borderLeftWidth: 0,
    borderRightWidth: 1,
    borderRightColor: c.border,
    alignItems: 'flex-start',
  },
  invLabel: { fontSize: 7.5, color: c.muted, marginBottom: 3 },
  invNumber: { fontSize: 14, fontWeight: 700, color: c.ink },
  statusPill: {
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  statusText: { fontSize: 8, fontWeight: 700 },
  sectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 2,
  },
  sectionAccent: {
    width: 3,
    height: 12,
    backgroundColor: c.primary,
    marginRight: 6,
  },
  sectionAccentRtl: { marginRight: 0, marginLeft: 6 },
  sectionTitle: {
    fontSize: 8,
    fontWeight: 700,
    color: c.primaryDark,
    textTransform: 'uppercase',
  },
  partiesRow: { flexDirection: 'row', marginBottom: 16 },
  partyCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.border,
    padding: 12,
    backgroundColor: c.surface,
  },
  partyCardFirst: { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 },
  partyCardLast: { borderTopRightRadius: 6, borderBottomRightRadius: 6, borderLeftWidth: 0 },
  partyCardFirstRtl: { borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderTopRightRadius: 6, borderBottomRightRadius: 6 },
  partyCardLastRtl: { borderTopRightRadius: 0, borderBottomRightRadius: 0, borderTopLeftRadius: 6, borderBottomLeftRadius: 6, borderLeftWidth: 1, borderRightWidth: 0 },
  partyLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: c.muted,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  partyName: { fontSize: 11, fontWeight: 700, marginBottom: 5, lineHeight: 1.35 },
  partyLine: { fontSize: 8.5, color: c.muted, marginBottom: 2, lineHeight: 1.4 },
  partyTax: { fontSize: 8, color: c.ink, marginTop: 2, lineHeight: 1.35 },
  metaGrid: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: 18,
  },
  metaCell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: c.border,
    backgroundColor: c.white,
  },
  metaCellLast: { borderRightWidth: 0 },
  metaCellRtl: { borderRightWidth: 0, borderLeftWidth: 1, borderLeftColor: c.border },
  metaCellLastRtl: { borderLeftWidth: 0 },
  metaLabel: { fontSize: 7, color: c.muted, marginBottom: 3 },
  metaValue: { fontSize: 9.5, fontWeight: 700, color: c.ink },
  table: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    marginBottom: 16,
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: c.primaryDark,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  th: { color: c.white, fontSize: 7.5, fontWeight: 700 },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    alignItems: 'flex-start',
    minHeight: 28,
  },
  tableRowAlt: { backgroundColor: c.surface },
  tableRowLast: { borderBottomWidth: 0 },
  colDesc: { width: '46%' },
  colQty: { width: '10%', textAlign: 'center' },
  colUnit: { width: '22%', textAlign: 'right', paddingHorizontal: 4 },
  colAmount: { width: '22%', textAlign: 'right', paddingHorizontal: 4 },
  colDescRtl: { textAlign: 'right' },
  colQtyRtl: { textAlign: 'center' },
  colUnitRtl: { textAlign: 'left', paddingHorizontal: 4 },
  colAmountRtl: { textAlign: 'left', paddingHorizontal: 4 },
  thRtl: { textAlign: 'right' },
  thQtyRtl: { textAlign: 'center' },
  thNumRtl: { textAlign: 'left' },
  itemPrimary: { fontSize: 9.5, lineHeight: 1.4, color: c.ink },
  itemSecondary: { fontSize: 8, color: c.muted, marginTop: 2, lineHeight: 1.35 },
  summaryWrap: { flexDirection: 'row', marginBottom: 14 },
  summarySpacer: { flex: 1 },
  summaryPanel: {
    width: 248,
    borderWidth: 1,
    borderColor: c.borderStrong,
    backgroundColor: c.surface,
  },
  summaryHead: {
    backgroundColor: c.primaryDark,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  summaryHeadText: { fontSize: 8, fontWeight: 700, color: c.white },
  summaryBody: { paddingVertical: 10, paddingHorizontal: 12 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 8.5, color: c.muted, flex: 1, paddingRight: 8 },
  summaryLabelRtl: { paddingRight: 0, paddingLeft: 8, textAlign: 'right' },
  summaryValue: { fontSize: 9.5, fontWeight: 700, minWidth: 88, textAlign: 'right' },
  summaryValueRtl: { textAlign: 'left' },
  summaryDivider: {
    borderTopWidth: 1,
    borderTopColor: c.borderStrong,
    marginVertical: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: c.primary,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 4,
  },
  balanceLabel: { fontSize: 10, fontWeight: 700, color: c.ink },
  balanceValue: { fontSize: 12, fontWeight: 700 },
  balanceDue: { color: c.danger },
  balanceZero: { color: c.success },
  bottomGrid: { flexDirection: 'row', marginBottom: 14 },
  instPanel: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.border,
    marginRight: 12,
    backgroundColor: c.white,
  },
  instPanelRtl: { marginRight: 0, marginLeft: 12 },
  instHead: {
    backgroundColor: c.surface,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  instHeadText: { fontSize: 8, fontWeight: 700, color: c.primaryDark },
  instRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: c.border,
  },
  instRowLast: { borderBottomWidth: 0 },
  instLabel: { fontSize: 8.5, color: c.ink, flex: 1, paddingRight: 8 },
  instLabelRtl: { paddingRight: 0, paddingLeft: 8, textAlign: 'right' },
  instAmount: { fontSize: 8.5, fontWeight: 700, minWidth: 72, textAlign: 'right' },
  instAmountRtl: { textAlign: 'left' },
  bankBox: {
    borderWidth: 1,
    borderColor: c.primaryMuted,
    backgroundColor: c.primarySoft,
    padding: 12,
    marginBottom: 12,
    borderRadius: 4,
  },
  bankGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  bankCol: { width: '50%', paddingRight: 8, marginBottom: 4 },
  bankColRtl: { paddingRight: 0, paddingLeft: 8 },
  bankTitle: { fontSize: 8, fontWeight: 700, color: c.primaryDark, marginBottom: 8 },
  bankLine: { fontSize: 8.5, color: c.ink, lineHeight: 1.45, marginBottom: 3 },
  bankMono: { fontSize: 8.5, color: c.ink, letterSpacing: 0.4 },
  notesBox: {
    borderWidth: 1,
    borderColor: c.border,
    borderLeftWidth: 3,
    borderLeftColor: c.primary,
    padding: 12,
    marginBottom: 12,
    backgroundColor: c.white,
  },
  notesBoxRtl: { borderLeftWidth: 1, borderRightWidth: 3, borderRightColor: c.primary },
  notesBody: { fontSize: 9, lineHeight: 1.5, color: c.ink, marginTop: 4 },
  footer: {
    position: 'absolute',
    bottom: 22,
    left: PAGE_PAD_H,
    right: PAGE_PAD_H,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: c.muted, lineHeight: 1.4, maxWidth: '70%' },
  footerBrand: { fontSize: 7, color: c.primary, fontWeight: 700 },
})

function statusPillStyle(status: InvoiceStatus) {
  switch (status) {
    case 'paid':
      return { backgroundColor: c.successSoft, color: c.success }
    case 'partial':
      return { backgroundColor: c.warningSoft, color: c.warning }
    case 'overdue':
      return { backgroundColor: c.dangerSoft, color: c.danger }
    default:
      return { backgroundColor: c.primarySoft, color: c.primaryDark }
  }
}

function SectionHeading({ title, rtl }: { title: string; rtl: boolean }) {
  return (
    <View style={[styles.sectionBar, rtl ? { flexDirection: 'row-reverse' } : {}]}>
      <View style={rtl ? styles.sectionAccentRtl : styles.sectionAccent} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  )
}

function PartyBlock({
  label,
  party,
  labels,
  rtl,
  first,
  last,
}: {
  label: string
  party: InvoicePdfParty
  labels: InvoicePdfLabels
  rtl: boolean
  first: boolean
  last: boolean
}) {
  const lines: string[] = []
  if (party.contactName) lines.push(party.contactName)
  if (party.phone) lines.push(formatLabel(labels.tel, { phone: party.phone }))
  const location = [party.address, party.city].filter(Boolean).join(', ')
  if (location) lines.push(location)

  const cardStyle = [
    styles.partyCard,
    first ? (rtl ? styles.partyCardFirstRtl : styles.partyCardFirst) : {},
    last ? (rtl ? styles.partyCardLastRtl : styles.partyCardLast) : {},
  ]

  return (
    <View style={cardStyle}>
      <Text style={[styles.partyLabel, rtl ? { textAlign: 'right' } : {}]}>{label}</Text>
      <Text style={[styles.partyName, rtl ? { textAlign: 'right' } : {}]}>{party.businessName}</Text>
      {lines.map((line, i) => (
        <Text key={i} style={[styles.partyLine, rtl ? { textAlign: 'right' } : {}]}>
          {line}
        </Text>
      ))}
      {party.vatRegistered || party.taxId || party.commercialRegistration ? (
        <View style={{ marginTop: 6 }}>
          {party.vatRegistered ? (
            <Text style={[styles.partyTax, rtl ? { textAlign: 'right' } : {}]}>{labels.vatRegistered}</Text>
          ) : null}
          {party.taxId ? (
            <Text style={[styles.partyTax, rtl ? { textAlign: 'right' } : {}]}>
              {formatLabel(labels.taxId, { id: party.taxId })}
            </Text>
          ) : null}
          {party.commercialRegistration ? (
            <Text style={[styles.partyTax, rtl ? { textAlign: 'right' } : {}]}>
              {formatLabel(labels.commercialReg, { id: party.commercialRegistration })}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function MetaCell({
  label,
  value,
  rtl,
  last,
}: {
  label: string
  value: string
  rtl: boolean
  last: boolean
}) {
  return (
    <View
      style={[
        styles.metaCell,
        rtl ? styles.metaCellRtl : {},
        last ? (rtl ? styles.metaCellLastRtl : styles.metaCellLast) : {},
      ]}
    >
      <Text style={[styles.metaLabel, rtl ? { textAlign: 'right' } : {}]}>{label}</Text>
      <Text style={[styles.metaValue, rtl ? { textAlign: 'right' } : {}]}>{value}</Text>
    </View>
  )
}

function LineItemsTable({
  lines,
  labels,
  currencyCode,
  locale,
  rtl,
}: {
  lines: InvoicePdfLine[]
  labels: InvoicePdfLabels
  currencyCode: string
  locale: AppLocale
  rtl: boolean
}) {
  const rowDir = rtl ? 'row-reverse' : 'row'
  const thDesc = [styles.th, styles.colDesc, rtl ? styles.colDescRtl : {}, rtl ? styles.thRtl : {}]
  const thQty = [styles.th, styles.colQty, rtl ? styles.colQtyRtl : {}, rtl ? styles.thQtyRtl : {}]
  const thUnit = [styles.th, styles.colUnit, rtl ? styles.colUnitRtl : {}, rtl ? styles.thNumRtl : {}]
  const thAmt = [styles.th, styles.colAmount, rtl ? styles.colAmountRtl : {}, rtl ? styles.thNumRtl : {}]

  return (
    <View style={styles.table}>
      <View style={[styles.tableHead, { flexDirection: rowDir }]}>
        <Text style={thDesc}>{labels.colDescription}</Text>
        <Text style={thQty}>{labels.colQty}</Text>
        <Text style={thUnit}>{labels.colUnitPrice}</Text>
        <Text style={thAmt}>{labels.colAmount}</Text>
      </View>
      {lines.length === 0 ? (
        <View style={styles.tableRow}>
          <Text style={[styles.itemPrimary, { width: '100%', textAlign: 'center', color: c.muted }]}>—</Text>
        </View>
      ) : (
        lines.map((l, i) => {
          const { primary, secondary } = formatLineItemLabel(l.product_name, l.variation_name)
          const isLast = i === lines.length - 1
          return (
            <View
              key={i}
              style={[
                styles.tableRow,
                { flexDirection: rowDir },
                i % 2 === 1 ? styles.tableRowAlt : {},
                isLast ? styles.tableRowLast : {},
              ]}
            >
              <View style={styles.colDesc}>
                <Text style={[styles.itemPrimary, rtl ? { textAlign: 'right' } : {}]}>{primary}</Text>
                {secondary ? (
                  <Text style={[styles.itemSecondary, rtl ? { textAlign: 'right' } : {}]}>{secondary}</Text>
                ) : null}
              </View>
              <Text style={[styles.colQty, rtl ? styles.colQtyRtl : {}]}>{String(l.quantity)}</Text>
              <Text style={[styles.colUnit, rtl ? styles.colUnitRtl : {}]}>
                {formatPdfMoney(l.unit_price, currencyCode, locale)}
              </Text>
              <Text style={[styles.colAmount, rtl ? styles.colAmountRtl : {}]}>
                {formatPdfMoney(l.total_price, currencyCode, locale)}
              </Text>
            </View>
          )
        })
      )}
    </View>
  )
}

function AmountSummary({
  labels,
  currencyCode,
  locale,
  total,
  paidTotal,
  remaining,
  rtl,
}: {
  labels: InvoicePdfLabels
  currencyCode: string
  locale: AppLocale
  total: number
  paidTotal: number
  remaining: number
  rtl: boolean
}) {
  const balanceStyle = remaining > 0.009 ? styles.balanceDue : styles.balanceZero
  const rowDir = rtl ? 'row-reverse' : 'row'

  return (
    <View style={[styles.summaryWrap, { flexDirection: rowDir }]}>
      <View style={styles.summarySpacer} />
      <View style={styles.summaryPanel}>
        <View style={styles.summaryHead}>
          <Text style={[styles.summaryHeadText, rtl ? { textAlign: 'right' } : {}]}>{labels.amountSummary}</Text>
        </View>
        <View style={styles.summaryBody}>
          <View style={[styles.summaryRow, { flexDirection: rowDir }]}>
            <Text style={[styles.summaryLabel, rtl ? styles.summaryLabelRtl : {}]}>{labels.invoiceTotal}</Text>
            <Text style={[styles.summaryValue, rtl ? styles.summaryValueRtl : {}]}>
              {formatPdfMoney(total, currencyCode, locale)}
            </Text>
          </View>
          <View style={[styles.summaryRow, { flexDirection: rowDir }]}>
            <Text style={[styles.summaryLabel, rtl ? styles.summaryLabelRtl : {}]}>{labels.amountPaid}</Text>
            <Text style={[styles.summaryValue, rtl ? styles.summaryValueRtl : {}]}>
              {formatPdfMoney(paidTotal, currencyCode, locale)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={[styles.balanceRow, { flexDirection: rowDir }]}>
            <Text style={[styles.balanceLabel, rtl ? { textAlign: 'right' } : {}]}>{labels.balanceDue}</Text>
            <Text style={[styles.balanceValue, balanceStyle, rtl ? { textAlign: 'left' } : { textAlign: 'right' }]}>
              {formatPdfMoney(remaining, currencyCode, locale)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

export function InvoicePdfDocument(props: InvoicePdfProps) {
  const { locale, labels } = props
  const rtl = locale === 'ar'
  const statusLabel = pdfStatusLabel(labels, props.status)
  const pill = statusPillStyle(props.status)
  const showInstallments = props.installments.length > 0
  const rowDir = rtl ? 'row-reverse' : 'row'

  const metaItems = [
    { label: labels.issued, value: formatPdfDate(props.issuedAt, locale) },
    { label: labels.dueDate, value: formatPdfDate(props.dueDate, locale) },
    { label: labels.orderRef, value: props.orderRef },
    { label: labels.currency, value: props.currencyCode.toUpperCase() },
    ...(props.paidAt ? [{ label: labels.paidOn, value: formatPdfDate(props.paidAt, locale) }] : []),
  ]

  const bankLines: { text: string; mono?: boolean }[] = props.bank
    ? [
        { text: formatLabel(labels.bank, { name: props.bank.bankName }) },
        ...(props.bank.branch ? [{ text: formatLabel(labels.branch, { name: props.bank.branch }) }] : []),
        { text: formatLabel(labels.accountHolder, { name: props.bank.accountHolder }) },
        ...(props.bank.iban ? [{ text: formatLabel(labels.iban, { value: props.bank.iban }), mono: true }] : []),
        ...(props.bank.accountNumber
          ? [{ text: formatLabel(labels.accountNo, { value: props.bank.accountNumber }), mono: true }]
          : []),
        ...(props.bank.swift ? [{ text: formatLabel(labels.swift, { value: props.bank.swift }), mono: true }] : []),
      ]
    : []

  return (
    <Document title={formatLabel(labels.documentTitle, { invoiceNumber: props.invoiceNumber })}>
      <Page size="A4" style={styles.page}>
        <View style={[styles.header, { flexDirection: rowDir }]}>
          <View style={[styles.headerMain, rtl ? { alignItems: 'flex-end' } : {}]}>
            <Text style={[styles.headerBrand, rtl ? { textAlign: 'right' } : {}]}>{labels.brand}</Text>
            <Text style={[styles.headerTitle, rtl ? { textAlign: 'right' } : {}]}>{labels.headerTitle}</Text>
            <Text style={[styles.headerSub, rtl ? { textAlign: 'right' } : {}]}>{labels.headerSub}</Text>
          </View>
          <View style={[styles.headerAside, rtl ? styles.headerAsideRtl : {}]}>
            <Text style={[styles.invLabel, { textAlign: rtl ? 'left' : 'right' }]}>{labels.invoiceNo}</Text>
            <Text style={[styles.invNumber, { textAlign: rtl ? 'left' : 'right' }]}>{props.invoiceNumber}</Text>
            <View style={[styles.statusPill, { backgroundColor: pill.backgroundColor }]}>
              <Text style={[styles.statusText, { color: pill.color }]}>{statusLabel}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.partiesRow, { flexDirection: rowDir }]}>
          <PartyBlock label={labels.fromSupplier} party={props.supplier} labels={labels} rtl={rtl} first last={false} />
          <PartyBlock label={labels.billToRetailer} party={props.retailer} labels={labels} rtl={rtl} first={false} last />
        </View>

        <View style={[styles.metaGrid, { flexDirection: rowDir }]}>
          {metaItems.map((item, i) => (
            <MetaCell
              key={item.label}
              label={item.label}
              value={item.value}
              rtl={rtl}
              last={i === metaItems.length - 1}
            />
          ))}
        </View>

        <SectionHeading title={labels.lineItems} rtl={rtl} />
        <LineItemsTable
          lines={props.lines}
          labels={labels}
          currencyCode={props.currencyCode}
          locale={locale}
          rtl={rtl}
        />

        <AmountSummary
          labels={labels}
          currencyCode={props.currencyCode}
          locale={locale}
          total={props.total}
          paidTotal={props.paidTotal}
          remaining={props.remaining}
          rtl={rtl}
        />

        {showInstallments ? (
          <View style={{ marginBottom: 14 }}>
            <SectionHeading title={labels.installmentSchedule} rtl={rtl} />
            <View style={styles.instPanel}>
              <View style={styles.instHead}>
                <Text style={[styles.instHeadText, rtl ? { textAlign: 'right' } : {}]}>
                  {labels.installmentSchedule}
                </Text>
              </View>
              {props.installments.map((inst, i) => {
                const isLast = i === props.installments.length - 1
                return (
                  <View
                    key={inst.seq}
                    style={[styles.instRow, { flexDirection: rowDir }, isLast ? styles.instRowLast : {}]}
                  >
                    <Text style={[styles.instLabel, rtl ? styles.instLabelRtl : {}]}>
                      {formatLabel(labels.installmentDue, {
                        seq: inst.seq,
                        date: formatPdfDate(inst.dueDate, locale),
                      })}
                    </Text>
                    <Text style={[styles.instAmount, rtl ? styles.instAmountRtl : {}]}>
                      {formatPdfMoney(inst.remaining > 0 ? inst.remaining : 0, props.currencyCode, locale)}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>
        ) : null}

        {props.bank ? (
          <View style={styles.bankBox}>
            <Text style={[styles.bankTitle, rtl ? { textAlign: 'right' } : {}]}>{labels.paymentDetails}</Text>
            <View style={[styles.bankGrid, { flexDirection: rowDir }]}>
              {bankLines.map((line, i) => (
                <View key={i} style={[styles.bankCol, rtl ? styles.bankColRtl : {}, { width: '100%' }]}>
                  <Text style={line.mono ? styles.bankMono : styles.bankLine}>{line.text}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {props.notes ? (
          <View style={[styles.notesBox, rtl ? styles.notesBoxRtl : {}]}>
            <SectionHeading title={labels.notes} rtl={rtl} />
            <Text style={[styles.notesBody, rtl ? { textAlign: 'right' } : {}]}>{props.notes}</Text>
          </View>
        ) : null}

        <View style={[styles.footer, { flexDirection: rowDir }]} fixed>
          <Text style={[styles.footerText, rtl ? { textAlign: 'right' } : {}]}>
            {formatLabel(labels.footerRef, { invoiceNumber: props.invoiceNumber })}
          </Text>
          <Text style={[styles.footerBrand, rtl ? { textAlign: 'left' } : { textAlign: 'right' }]}>
            {labels.footerThanks}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
