import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

/** Refresh supplier_inventory_velocity_mv (rolling 30d sales). Same auth as overdue-reminders: CRON_SECRET + service role. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = req.headers.get('authorization')?.trim()
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null

  if (!secret || bearer !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = supabaseAdmin()
  const { error } = await admin.rpc('refresh_supplier_inventory_velocity_mv')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
