import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { LedgerListRow } from '@/lib/data/ledger'

export type LedgerStatementProps = {
  title: string
  supplierName: string
  retailerName: string | null
  currency: string
  totalInvoiced: number
  totalCollected: number
  netBalance: number
  rows: LedgerListRow[]
  generatedAt: string
}

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica' },
  title: { fontSize: 16, marginBottom: 8, fontFamily: 'Helvetica', fontWeight: 'bold' },
  subtitle: { fontSize: 10, marginBottom: 16, color: '#555' },
  summaryRow: { flexDirection: 'row', marginBottom: 4 },
  summaryLabel: { width: 120, color: '#555' },
  summaryValue: { fontWeight: 'bold' },
  hr: { borderBottomWidth: 1, borderBottomColor: '#ddd', marginVertical: 12 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#999', paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  colDate: { width: '18%' },
  colType: { width: '12%' },
  colCounterpart: { width: '20%' },
  colDesc: { width: '22%' },
  colAmount: { width: '14%', textAlign: 'right' },
  colBalance: { width: '14%', textAlign: 'right' },
  headerText: { fontSize: 8, fontWeight: 'bold', color: '#555', textTransform: 'uppercase' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 7, color: '#999', textAlign: 'center' },
})

function fmtMoney(n: number, ccy: string) {
  return `${ccy} ${n.toFixed(2)}`
}

export function LedgerStatementDocument({
  title, supplierName, retailerName, currency,
  totalInvoiced, totalCollected, netBalance, rows, generatedAt,
}: LedgerStatementProps) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.subtitle}>
          {supplierName}{retailerName ? ` — ${retailerName}` : ''} | {generatedAt}
        </Text>

        <View style={s.summaryRow}>
          <Text style={s.summaryLabel}>Total Invoiced:</Text>
          <Text style={s.summaryValue}>{fmtMoney(totalInvoiced, currency)}</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={s.summaryLabel}>Total Collected:</Text>
          <Text style={s.summaryValue}>{fmtMoney(totalCollected, currency)}</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={s.summaryLabel}>Outstanding:</Text>
          <Text style={s.summaryValue}>{fmtMoney(netBalance, currency)}</Text>
        </View>

        <View style={s.hr} />

        <View style={s.tableHeader}>
          <Text style={[s.colDate, s.headerText]}>Date</Text>
          <Text style={[s.colType, s.headerText]}>Type</Text>
          <Text style={[s.colCounterpart, s.headerText]}>Party</Text>
          <Text style={[s.colDesc, s.headerText]}>Description</Text>
          <Text style={[s.colAmount, s.headerText]}>Amount</Text>
          <Text style={[s.colBalance, s.headerText]}>Balance</Text>
        </View>

        {rows.map((r) => (
          <View key={r.id} style={s.tableRow}>
            <Text style={s.colDate}>{new Date(r.created_at).toLocaleDateString('en-GB')}</Text>
            <Text style={s.colType}>{r.type.replace('_', ' ')}</Text>
            <Text style={s.colCounterpart}>{r.counterpart}</Text>
            <Text style={s.colDesc}>{r.description ?? ''}</Text>
            <Text style={s.colAmount}>{fmtMoney(r.amount, currency)}</Text>
            <Text style={s.colBalance}>{fmtMoney(r.runningBalance, currency)}</Text>
          </View>
        ))}

        <Text style={s.footer}>
          Account Statement — {supplierName} — Generated {generatedAt}
        </Text>
      </Page>
    </Document>
  )
}
