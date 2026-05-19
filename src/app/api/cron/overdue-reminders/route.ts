import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

/** Scheduled job: enqueue overdue invoice reminder notifications (supplier inbox). Secured with CRON_SECRET. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = req.headers.get('authorization')?.trim()
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null

  if (!secret || bearer !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin.rpc('enqueue_overdue_invoice_reminders')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ inserted: data ?? 0 })
}
