'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assignDeliveryPersonSchema, deliveryPersonSchema } from '@/lib/validations/delivery-person'
import { writeAuditLog } from '@/lib/data/audit-log'

function zodFirstMessage(err: { issues: { message: string }[] }) {
  return err.issues[0]?.message ?? 'Invalid input'
}

export type DeliveryPersonRow = {
  id: string
  supplier_id: string
  name: string
  phone: string
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

async function getSupplierForUser() {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  return data ?? null
}

async function getCurrentUserId() {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function createDeliveryPerson(input: unknown) {
  const supplier = await getSupplierForUser()
  if (!supplier) return { data: null as DeliveryPersonRow | null, error: 'Unauthorized' }

  const parsed = deliveryPersonSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: zodFirstMessage(parsed.error) }

  const notesTrim = parsed.data.notes?.trim()
  const payload = {
    supplier_id: supplier.id,
    name: parsed.data.name,
    phone: parsed.data.phone,
    is_active: parsed.data.is_active ?? true,
    notes: notesTrim ? notesTrim : null,
  }

  const supabase = supabaseServer()
  const { data, error } = await supabase.from('delivery_persons').insert(payload).select().single()

  if (error) return { data: null, error: error.message }

  revalidatePath('/supplier/delivery-persons')
  return { data: data as DeliveryPersonRow, error: null }
}

export async function updateDeliveryPerson(id: string, input: unknown) {
  const supplier = await getSupplierForUser()
  if (!supplier) return { data: null as DeliveryPersonRow | null, error: 'Unauthorized' }

  const supabase = supabaseServer()
  const { data: existing } = await supabase
    .from('delivery_persons')
    .select('id')
    .eq('id', id)
    .eq('supplier_id', supplier.id)
    .maybeSingle()

  if (!existing) return { data: null, error: 'Delivery person not found or access denied' }

  const parsed = deliveryPersonSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: zodFirstMessage(parsed.error) }

  const notesTrim = parsed.data.notes?.trim()

  const { data, error } = await supabase
    .from('delivery_persons')
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone,
      is_active: parsed.data.is_active ?? true,
      notes: notesTrim ? notesTrim : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  revalidatePath('/supplier/delivery-persons')
  revalidatePath('/supplier/orders')
  return { data: data as DeliveryPersonRow, error: null }
}

export async function deleteDeliveryPerson(id: string) {
  const supplier = await getSupplierForUser()
  if (!supplier) return { error: 'Unauthorized' }

  const supabase = supabaseServer()

  const { data: activeOrders } = await supabase
    .from('orders')
    .select('id')
    .eq('delivery_person_id', id)
    .eq('status', 'shipped')

  if (activeOrders && activeOrders.length > 0) {
    return {
      error: `Cannot delete: this person is assigned to ${activeOrders.length} in-transit order(s). Reassign or deliver those orders first.`,
    }
  }

  const { error } = await supabase.from('delivery_persons').delete().eq('id', id).eq('supplier_id', supplier.id)

  if (error) return { error: error.message }

  revalidatePath('/supplier/delivery-persons')
  return { error: null }
}

export async function toggleDeliveryPersonActive(id: string, isActive: boolean) {
  const supplier = await getSupplierForUser()
  if (!supplier) return { error: 'Unauthorized' }

  const supabase = supabaseServer()
  const { error } = await supabase
    .from('delivery_persons')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('supplier_id', supplier.id)

  if (error) return { error: error.message }

  revalidatePath('/supplier/delivery-persons')
  return { error: null }
}

export async function getDeliveryPersons(activeOnly = false) {
  const supplier = await getSupplierForUser()
  if (!supplier) return { data: null as DeliveryPersonRow[] | null, error: 'Unauthorized' }

  const supabase = supabaseServer()
  let query = supabase
    .from('delivery_persons')
    .select('*')
    .eq('supplier_id', supplier.id)
    .order('name', { ascending: true })

  if (activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query
  return { data: (data ?? []) as DeliveryPersonRow[], error: error?.message ?? null }
}

export async function markOrderShippedWithDeliveryPerson(input: unknown) {
  const supplier = await getSupplierForUser()
  if (!supplier) return { error: 'Unauthorized' }

  const parsed = assignDeliveryPersonSchema.safeParse(input)
  if (!parsed.success) return { error: zodFirstMessage(parsed.error) }

  const { orderId, deliveryPersonId } = parsed.data
  const supabase = supabaseServer()

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, supplier_id, retailer_id')
    .eq('id', orderId)
    .eq('supplier_id', supplier.id)
    .maybeSingle()

  if (!order) return { error: 'Order not found or access denied' }
  if (order.status !== 'preparing') {
    return { error: `Order must be in 'preparing' status to mark as shipped. Current status: ${order.status}` }
  }

  const { data: dp } = await supabase
    .from('delivery_persons')
    .select('id, name, phone')
    .eq('id', deliveryPersonId)
    .eq('supplier_id', supplier.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!dp) return { error: 'Selected delivery person is inactive or not found' }

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'shipped',
      delivery_person_id: deliveryPersonId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('status', 'preparing')

  if (updateError) return { error: updateError.message }

  try {
    const admin = supabaseAdmin()
    await admin.from('notifications').insert({
      user_id: order.retailer_id,
      type: 'delivery_assigned',
      title: 'Your order is on its way!',
      message: `Your order has been shipped. Delivery person: ${dp.name} — ${dp.phone}`,
      title_key: 'deliveryOnTheWay.title',
      message_key: 'deliveryOnTheWay.message',
      params: { name: dp.name, phone: dp.phone },
      reference_id: orderId,
      reference_type: 'order',
    })
  } catch {
    // best-effort
  }

  const actorId = await getCurrentUserId()
  if (actorId) {
    await writeAuditLog({
      actorId,
      eventType: 'order_shipped',
      orderId,
      metadata: {
        from_status: 'preparing',
        to_status: 'shipped',
        delivery_person_id: dp.id,
        delivery_person_name: dp.name,
        delivery_person_phone: dp.phone,
      },
    })
  }

  revalidatePath(`/supplier/orders/${orderId}`)
  revalidatePath('/supplier/orders')
  revalidatePath(`/retailer/orders/${orderId}`)
  revalidatePath('/retailer/orders')
  return { error: null }
}

export async function reassignDeliveryPerson(orderId: string, deliveryPersonId: string) {
  const supplier = await getSupplierForUser()
  if (!supplier) return { error: 'Unauthorized' }

  const supabase = supabaseServer()

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, retailer_id')
    .eq('id', orderId)
    .eq('supplier_id', supplier.id)
    .maybeSingle()

  if (!order) return { error: 'Order not found' }
  if (order.status !== 'shipped') {
    return { error: 'Can only reassign delivery person on orders with shipped status' }
  }

  const { data: dp } = await supabase
    .from('delivery_persons')
    .select('id, name, phone')
    .eq('id', deliveryPersonId)
    .eq('supplier_id', supplier.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!dp) return { error: 'Delivery person not found or inactive' }

  const { error } = await supabase
    .from('orders')
    .update({ delivery_person_id: deliveryPersonId, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  if (error) return { error: error.message }

  try {
    const admin = supabaseAdmin()
    await admin.from('notifications').insert({
      user_id: order.retailer_id,
      type: 'delivery_assigned',
      title: 'Delivery person updated',
      message: `Your delivery person has been updated: ${dp.name} — ${dp.phone}`,
      title_key: 'deliveryUpdated.title',
      message_key: 'deliveryUpdated.message',
      params: { name: dp.name, phone: dp.phone },
      reference_id: orderId,
      reference_type: 'order',
    })
  } catch {
    // best-effort
  }

  const actorId = await getCurrentUserId()
  if (actorId) {
    await writeAuditLog({
      actorId,
      eventType: 'delivery_person_reassigned',
      orderId,
      metadata: {
        delivery_person_id: dp.id,
        delivery_person_name: dp.name,
        delivery_person_phone: dp.phone,
      },
    })
  }

  revalidatePath(`/supplier/orders/${orderId}`)
  revalidatePath(`/retailer/orders/${orderId}`)
  return { error: null }
}
