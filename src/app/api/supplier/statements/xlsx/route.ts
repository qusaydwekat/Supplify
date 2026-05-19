import { NextResponse, type NextRequest } from 'next/server'
import ExcelJS from 'exceljs'
import { fetchPartnerStatementRows } from '@/lib/data/partner-statement'
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

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Supplify'
  const ws = wb.addWorksheet('Statement', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  ws.columns = [
    { header: 'Date', key: 'line_ts', width: 22 },
    { header: 'Kind', key: 'entry_kind', width: 14 },
    { header: 'Reference', key: 'reference_id', width: 38 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Debit', key: 'debit', width: 12 },
    { header: 'Credit', key: 'credit', width: 12 },
    { header: 'Balance', key: 'running_balance', width: 14 },
  ]

  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8E8E8' },
  }

  for (const r of stmt.rows) {
    ws.addRow({
      line_ts: new Date(r.line_ts).toISOString(),
      entry_kind: r.entry_kind,
      reference_id: r.reference_id,
      description: r.description ?? '',
      debit: Number(r.debit),
      credit: Number(r.credit),
      running_balance: Number(r.running_balance),
    })
  }

  const buf = await wb.xlsx.writeBuffer()

  return new NextResponse(Buffer.from(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="statement-${retailerId.slice(0, 8)}.xlsx"`,
    },
  })
}
