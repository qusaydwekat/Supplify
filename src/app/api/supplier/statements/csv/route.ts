import { NextResponse, type NextRequest } from 'next/server'
import { fetchPartnerStatementRows } from '@/lib/data/partner-statement'
import { supabaseServer } from '@/lib/supabase/server'

/** CSV partner statement (legacy ledger running balance). Requires retailerId + optional date range. */
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

  const rows = stmt.rows

  const header = ['date', 'kind', 'reference_id', 'description', 'debit', 'credit', 'balance'].join(',')
  const body = rows
    .map((r) =>
      [
        r.line_ts,
        r.entry_kind,
        r.reference_id,
        `"${String(r.description ?? '').replace(/"/g, '""')}"`,
        r.debit,
        r.credit,
        r.running_balance,
      ].join(','),
    )
    .join('\n')

  const csv = `${header}\n${body}`
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="statement-${retailerId.slice(0, 8)}.csv"`,
    },
  })
}
