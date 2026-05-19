import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { syncMarketExchangeRatesJob } from '@/lib/exchange-rates/sync-market-rates-job'

/**
 * Daily live FX sync for admin global price settings (same logic as Admin → Sync live rates).
 * Secure with Authorization: Bearer <CRON_SECRET>. Configure Vercel Cron or any scheduler GET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = req.headers.get('authorization')?.trim()
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null

  if (!secret || bearer !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let admin
  try {
    admin = supabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Missing Supabase service role configuration' }, { status: 500 })
  }

  const result = await syncMarketExchangeRatesJob(admin)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    source: result.source,
    rateDate: result.rateDate,
    warning: result.metaWarning ?? null,
  })
}
