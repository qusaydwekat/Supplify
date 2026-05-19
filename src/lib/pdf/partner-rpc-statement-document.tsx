import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { PartnerStatementRpcRow } from '@/lib/data/partner-statement'

export type PartnerRpcStatementPdfProps = {
  title: string
  supplierName: string
  retailerName: string
  periodLabel: string
  currencyHint: string
  rows: PartnerStatementRpcRow[]
  generatedAt: string
}

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica' },
  title: { fontSize: 16, marginBottom: 6, fontFamily: 'Helvetica', fontWeight: 'bold' },
  subtitle: { fontSize: 10, marginBottom: 14, color: '#555' },
  meta: { fontSize: 8, marginBottom: 12, color: '#666' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#999', paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  colDate: { width: '14%' },
  colKind: { width: '11%' },
  colRef: { width: '14%' },
  colDesc: { width: '27%' },
  colDr: { width: '11%', textAlign: 'right' },
  colCr: { width: '11%', textAlign: 'right' },
  colBal: { width: '12%', textAlign: 'right' },
  headerText: { fontSize: 7, fontWeight: 'bold', color: '#555', textTransform: 'uppercase' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 7, color: '#999', textAlign: 'center' },
})

function fmtNum(n: number) {
  return n.toFixed(2)
}

export function PartnerRpcStatementDocument({
  title,
  supplierName,
  retailerName,
  periodLabel,
  currencyHint,
  rows,
  generatedAt,
}: PartnerRpcStatementPdfProps) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.subtitle}>
          {supplierName} → {retailerName}
        </Text>
        <Text style={s.meta}>
          {periodLabel} · {currencyHint} · Generated {generatedAt}
        </Text>

        <View style={s.tableHeader}>
          <Text style={[s.colDate, s.headerText]}>Date</Text>
          <Text style={[s.colKind, s.headerText]}>Kind</Text>
          <Text style={[s.colRef, s.headerText]}>Ref</Text>
          <Text style={[s.colDesc, s.headerText]}>Description</Text>
          <Text style={[s.colDr, s.headerText]}>Debit</Text>
          <Text style={[s.colCr, s.headerText]}>Credit</Text>
          <Text style={[s.colBal, s.headerText]}>Balance</Text>
        </View>

        {rows.map((r, i) => (
          <View key={`${r.reference_id}-${i}`} style={s.tableRow}>
            <Text style={s.colDate}>{new Date(r.line_ts).toLocaleDateString('en-GB')}</Text>
            <Text style={s.colKind}>{r.entry_kind}</Text>
            <Text style={s.colRef}>{String(r.reference_id).slice(0, 8)}…</Text>
            <Text style={s.colDesc}>{String(r.description ?? '').slice(0, 80)}</Text>
            <Text style={s.colDr}>{fmtNum(Number(r.debit))}</Text>
            <Text style={s.colCr}>{fmtNum(Number(r.credit))}</Text>
            <Text style={s.colBal}>{fmtNum(Number(r.running_balance))}</Text>
          </View>
        ))}

        <Text style={s.footer}>Ledger-based running balance (same source as CSV export).</Text>
      </Page>
    </Document>
  )
}
