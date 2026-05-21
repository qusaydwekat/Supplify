import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { defaultLocale, isAppLocale, localeCookieName, type AppLocale } from '@/i18n/routing'
import { getSupplierLedgerPageData } from '@/lib/data/ledger'
import {
  loadLedgerStatementPdfLabels,
} from '@/lib/pdf/ledger-statement-pdf-i18n'
import { formatPdfDate } from '@/lib/pdf/pdf-format'
import { renderLedgerStatementPdfBuffer } from '@/lib/pdf/render-ledger-statement-pdf-buffer'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: roleRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (roleRow?.role !== 'supplier') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const partnerId = url.searchParams.get('partnerId')
  const filters = {
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
    type: url.searchParams.get('type'),
  }

  const data = await getSupplierLedgerPageData(partnerId, { load: 'all' }, filters)
  if ('error' in data) return NextResponse.json({ error: data.error }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_name, name')
    .eq('user_id', user.id)
    .maybeSingle()
  const supplierName = profile?.business_name ?? profile?.name ?? 'Supplier'

  let retailerName: string | null = null
  if (partnerId) {
    const { data: rp } = await supabase
      .from('profiles')
      .select('business_name, name')
      .eq('user_id', partnerId)
      .maybeSingle()
    retailerName = rp?.business_name ?? rp?.name ?? null
  }

  const rawLocale = (await cookies()).get(localeCookieName)?.value
  const locale: AppLocale = isAppLocale(rawLocale) ? rawLocale : defaultLocale
  const labels = await loadLedgerStatementPdfLabels(locale)
  const periodFrom = filters.from?.trim() ? formatPdfDate(filters.from, locale) : null
  const periodTo = filters.to?.trim() ? formatPdfDate(filters.to, locale) : null
  const generatedAt = formatPdfDate(new Date().toISOString(), locale)

  try {
    const buf = await renderLedgerStatementPdfBuffer({
      locale,
      labels,
      supplierName,
      retailerName,
      currencyCode: data.displayCurrency,
      periodFrom,
      periodTo,
      generatedAt,
      totalInvoiced: data.totalInvoiced,
      totalCollected: data.totalCollected,
      netBalance: data.netBalance,
      rows: data.rows.filter((row) => Boolean(row?.id)),
    })

    const slug =
      partnerId?.slice(0, 8) ||
      (retailerName
        ? retailerName.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
        : '') ||
      'all'
    const filename = `account-statement-${slug}.pdf`

    return new NextResponse(Buffer.from(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[ledger-statement-pdf]', message, err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
