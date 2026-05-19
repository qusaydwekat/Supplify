import { NextResponse, type NextRequest } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { fetchPartnerStatementRows } from '@/lib/data/partner-statement'
import { PartnerRpcStatementDocument } from '@/lib/pdf/partner-rpc-statement-document'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  if (!supplier) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const retailerId = req.nextUrl.searchParams.get('retailerId')
  if (!retailerId) return NextResponse.json({ error: 'retailerId required' }, { status: 400 })

  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')

  const stmt = await fetchPartnerStatementRows(supabase, {
    supplierId: supplier.id,
    retailerId,
    from,
    to,
  })
  if ('error' in stmt) return NextResponse.json({ error: stmt.error }, { status: 400 })

  const { data: supProf } = await supabase.from('profiles').select('business_name, name').eq('user_id', user.id).maybeSingle()
  const supplierName = supProf?.business_name ?? supProf?.name ?? 'Supplier'

  const { data: retProf } = await supabase.from('profiles').select('business_name, name').eq('user_id', retailerId).maybeSingle()
  const retailerName = retProf?.business_name ?? retProf?.name ?? 'Retailer'

  const periodBits = []
  if (from?.trim()) periodBits.push(`from ${from.trim()}`)
  if (to?.trim()) periodBits.push(`to ${to.trim()}`)
  const periodLabel = periodBits.length ? periodBits.join(' ') : 'All activity'

  const { data: supplierRow } = await supabase.from('suppliers').select('currency_code').eq('id', supplier.id).maybeSingle()
  const ccy = String((supplierRow as { currency_code?: string })?.currency_code ?? 'USD')

  const buf = await renderToBuffer(
    <PartnerRpcStatementDocument
      title="Partner account statement"
      supplierName={supplierName}
      retailerName={retailerName}
      periodLabel={periodLabel}
      currencyHint={`Amounts in supplier currency (${ccy}); legacy ledger lines.`}
      rows={stmt.rows}
      generatedAt={new Date().toLocaleString('en-GB')}
    />,
  )

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="statement-${retailerId.slice(0, 8)}.pdf"`,
    },
  })
}
