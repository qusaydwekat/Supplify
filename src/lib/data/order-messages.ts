import { unstable_noStore as noStore } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'

const BUCKET = 'order-attachments'
const SIGNED_TTL = 3600

export type OrderMessageRow = {
  id: string
  author_id: string
  body: string
  attachment_name: string | null
  attachment_url: string | null
  created_at: string
  author_label: string
}

export async function getOrderMessages(orderId: string): Promise<OrderMessageRow[] | { error: string }> {
  noStore()
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: order } = await supabase.from('orders').select('id, retailer_id, supplier_id').eq('id', orderId).maybeSingle()
  if (!order) return { error: 'Order not found' }

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  const isSupplier = supplier && order.supplier_id === supplier.id
  const isRetailer = order.retailer_id === user.id
  if (!isSupplier && !isRetailer) return { error: 'Forbidden' }

  const { data: rows, error } = await supabase
    .from('order_messages')
    .select('id, author_id, body, attachment_path, attachment_name, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }

  const authorIds = [...new Set((rows ?? []).map((r) => r.author_id as string))]
  const { data: profs } = await supabase.from('profiles').select('user_id, name, business_name').in('user_id', authorIds)
  const labelMap = new Map(
    (profs ?? []).map((p) => [
      p.user_id as string,
      (p.business_name || p.name || 'User').trim() || 'User',
    ]),
  )

  const out: OrderMessageRow[] = []
  for (const r of rows ?? []) {
    let attachment_url: string | null = null
    const path = r.attachment_path as string | null
    if (path) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL)
      attachment_url = signed?.signedUrl ?? null
    }
    out.push({
      id: r.id as string,
      author_id: r.author_id as string,
      body: String(r.body ?? ''),
      attachment_name: (r.attachment_name as string | null) ?? null,
      attachment_url,
      created_at: r.created_at as string,
      author_label: labelMap.get(r.author_id as string) ?? 'User',
    })
  }
  return out
}
