import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { getRetailerLedgerPageData, getSupplierLedgerPageData } from '@/lib/data/ledger'

function csvEscape(s: string) {
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET(req: Request) {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: roleRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const role = roleRow?.role

  const url = new URL(req.url)
  const partnerId = url.searchParams.get('partnerId')

  if (role === 'supplier') {
    const data = await getSupplierLedgerPageData(partnerId, { load: 'all' })
    if ('error' in data) return NextResponse.json({ error: data.error }, { status: 400 })
    const lines = [
      ['date', 'type', 'counterpart', 'description', 'amount', 'running_balance'].join(','),
      ...data.rows.map((r) =>
        [
          csvEscape(new Date(r.created_at).toISOString()),
          csvEscape(r.type),
          csvEscape(r.counterpart),
          csvEscape(r.description ?? ''),
          r.amount.toFixed(2),
          r.runningBalance.toFixed(2),
        ].join(','),
      ),
    ]
    const body = lines.join('\n')
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="ledger-statement.csv"',
      },
    })
  }

  if (role === 'retailer') {
    const data = await getRetailerLedgerPageData(partnerId, { load: 'all' })
    if ('error' in data) return NextResponse.json({ error: data.error }, { status: 400 })
    const lines = [
      ['date', 'type', 'counterpart', 'description', 'amount', 'running_balance'].join(','),
      ...data.rows.map((r) =>
        [
          csvEscape(new Date(r.created_at).toISOString()),
          csvEscape(r.type),
          csvEscape(r.counterpart),
          csvEscape(r.description ?? ''),
          r.amount.toFixed(2),
          r.runningBalance.toFixed(2),
        ].join(','),
      ),
    ]
    return new NextResponse(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="ledger-statement.csv"',
      },
    })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
