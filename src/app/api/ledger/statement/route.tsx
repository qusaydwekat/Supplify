import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { supabaseServer } from '@/lib/supabase/server'
import { getSupplierLedgerPageData } from '@/lib/data/ledger'
import { LedgerStatementDocument } from '@/lib/pdf/ledger-statement-document'

export async function GET(req: Request) {
  const supabase = supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: roleRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (roleRow?.role !== 'supplier') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const partnerId = url.searchParams.get('partnerId')

  const data = await getSupplierLedgerPageData(partnerId, { load: 'all' })
  if ('error' in data) return NextResponse.json({ error: data.error }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_name')
    .eq('user_id', user.id)
    .maybeSingle()
  const supplierName = profile?.business_name ?? 'Supplier'

  let retailerName: string | null = null
  if (partnerId) {
    const { data: rp } = await supabase
      .from('profiles')
      .select('business_name, name')
      .eq('user_id', partnerId)
      .maybeSingle()
    retailerName = rp?.business_name ?? rp?.name ?? null
  }

  const buf = await renderToBuffer(
    <LedgerStatementDocument
      title="Account Statement"
      supplierName={supplierName}
      retailerName={retailerName}
      currency={data.displayCurrency}
      totalInvoiced={data.totalInvoiced}
      totalCollected={data.totalCollected}
      netBalance={data.netBalance}
      rows={data.rows}
      generatedAt={new Date().toLocaleDateString('en-GB')}
    />,
  )

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="account-statement${partnerId ? `-${partnerId.slice(0, 8)}` : ''}.pdf"`,
    },
  })
}
