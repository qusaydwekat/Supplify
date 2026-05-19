import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { AppLocale } from '@/i18n/routing'
import { formatDateMedium } from '@/lib/format-datetime'

export type InvoicePdfLine = {
  product_name: string
  variation_name: string | null
  quantity: number
  unit_price: number
  total_price: number
}

export type InvoicePdfProps = {
  invoiceNumber: string
  issuedAt: string
  dueDate: string | null
  total: number
  currencyCode: string
  counterpartyLabel: string
  lines: InvoicePdfLine[]
  notes: string | null
  /** Matches UI language for issued/due date formatting */
  locale: AppLocale
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 18, marginBottom: 16, fontFamily: 'Helvetica', fontWeight: 'bold' },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 100, color: '#555' },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingBottom: 6,
    marginTop: 16,
    marginBottom: 6,
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
  },
  colProduct: { flex: 2 },
  colNum: { width: 50, textAlign: 'right' },
  colMoney: { width: 72, textAlign: 'right' },
  line: { flexDirection: 'row', marginBottom: 4 },
  total: { marginTop: 16, textAlign: 'right', fontFamily: 'Helvetica', fontWeight: 'bold', fontSize: 11 },
  notes: { marginTop: 20, color: '#444' },
})

function money(n: number, currencyCode: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(n)
}

export function InvoicePdfDocument(props: InvoicePdfProps) {
  const { locale } = props
  return (
    <Document title={`Invoice ${props.invoiceNumber}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Invoice {props.invoiceNumber}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Issued</Text>
          <Text>{formatDateMedium(props.issuedAt, locale)}</Text>
        </View>
        {props.dueDate ? (
          <View style={styles.row}>
            <Text style={styles.label}>Due</Text>
            <Text>{formatDateMedium(props.dueDate, locale)}</Text>
          </View>
        ) : null}
        <View style={styles.row}>
          <Text style={styles.label}>Bill to</Text>
          <Text>{props.counterpartyLabel}</Text>
        </View>
        <View style={styles.tableHeader}>
          <Text style={styles.colProduct}>Item</Text>
          <Text style={styles.colNum}>Qty</Text>
          <Text style={styles.colMoney}>Unit</Text>
          <Text style={styles.colMoney}>Total</Text>
        </View>
        {props.lines.map((l, i) => (
          <View key={i} style={styles.line} wrap={false}>
            <Text style={styles.colProduct}>
              {l.product_name}
              {l.variation_name ? ` (${l.variation_name})` : ''}
            </Text>
            <Text style={styles.colNum}>{l.quantity}</Text>
            <Text style={styles.colMoney}>{money(l.unit_price, props.currencyCode)}</Text>
            <Text style={styles.colMoney}>{money(l.total_price, props.currencyCode)}</Text>
          </View>
        ))}
        <Text style={styles.total}>Total {money(props.total, props.currencyCode)}</Text>
        {props.notes ? (
          <Text style={styles.notes}>
            Notes:{'\n'}
            {props.notes}
          </Text>
        ) : null}
      </Page>
    </Document>
  )
}
