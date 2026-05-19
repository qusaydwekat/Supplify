'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const BUCKET = 'order-attachments'
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'file'
}

export async function sendOrderMessage(formData: FormData): Promise<{ error: string | null }> {
  const orderId = formData.get('orderId')?.toString()?.trim()
  const bodyRaw = formData.get('body')?.toString() ?? ''
  const body = bodyRaw.trim()
  const file = formData.get('file')

  if (!orderId) return { error: 'Missing order' }

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: order } = await supabase
    .from('orders')
    .select('id, retailer_id, supplier_id')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return { error: 'Order not found' }

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  const isSupplier = Boolean(supplier && order.supplier_id === supplier.id)
  const isRetailer = order.retailer_id === user.id
  if (!isSupplier && !isRetailer) return { error: 'Forbidden' }

  let attachment_path: string | null = null
  let attachment_name: string | null = null

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return { error: 'File must be 5 MB or smaller' }
    const mime = file.type || 'application/octet-stream'
    if (!ALLOWED.has(mime)) return { error: 'Allowed types: PDF, PNG, JPEG, WebP' }

    const safe = sanitizeFilename(file.name)
    attachment_path = `${orderId}/${user.id}/${randomUUID()}-${safe}`
    attachment_name = file.name.slice(0, 200)

    const buf = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(attachment_path, buf, {
      contentType: mime,
      upsert: false,
    })
    if (upErr) return { error: upErr.message }
  }

  if (!body && !attachment_path) {
    return { error: 'Enter a message or attach a file' }
  }

  const { error: insErr } = await supabase.from('order_messages').insert({
    order_id: orderId,
    author_id: user.id,
    body: body || '',
    attachment_path,
    attachment_name,
  })

  if (insErr) {
    if (attachment_path) {
      await supabase.storage.from(BUCKET).remove([attachment_path])
    }
    return { error: insErr.message }
  }

  let counterpartyUserId: string | null = null
  if (isRetailer) {
    const { data: supRow } = await supabase.from('suppliers').select('user_id').eq('id', order.supplier_id).maybeSingle()
    counterpartyUserId = (supRow?.user_id as string) ?? null
  } else {
    counterpartyUserId = order.retailer_id as string
  }

  if (counterpartyUserId && counterpartyUserId !== user.id) {
    try {
      const admin = supabaseAdmin()
      await admin.from('notifications').insert({
        user_id: counterpartyUserId,
        type: 'order_message',
        title: 'New order message',
        message: body ? body.slice(0, 120) : 'A file was attached to an order conversation.',
        title_key: 'orderMessage.title',
        message_key: 'orderMessage.message',
        params: { preview: body ? body.slice(0, 120) : null },
        reference_id: orderId,
        reference_type: 'order',
      })
    } catch {
      // best-effort
    }
  }

  revalidatePath(`/supplier/orders/${orderId}`)
  revalidatePath(`/retailer/orders/${orderId}`)
  return { error: null }
}
