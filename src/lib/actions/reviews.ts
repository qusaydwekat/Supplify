'use server'

import { revalidatePath } from 'next/cache'
import { reviewSchema } from '@/lib/validations/reviews'
import { supabaseServer } from '@/lib/supabase/server'

export async function submitReview(input: unknown) {
  const parsed = reviewSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join('; ') }

  const { orderId, overallRating, deliveryRating, qualityRating, communicationRating, comment } = parsed.data

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, retailer_id, supplier_id, status')
    .eq('id', orderId)
    .maybeSingle()

  if (orderErr || !order) return { error: 'Order not found' }
  if (order.retailer_id !== user.id) return { error: 'Forbidden' }
  if (order.status !== 'delivered') return { error: 'Order must be delivered before reviewing' }

  const { data: existing } = await supabase
    .from('supplier_reviews')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle()
  if (existing) return { error: 'Already reviewed' }

  const { error: insertErr } = await supabase.from('supplier_reviews').insert({
    order_id: orderId,
    supplier_id: order.supplier_id,
    retailer_id: user.id,
    overall_rating: overallRating,
    delivery_rating: typeof deliveryRating === 'number' ? deliveryRating : null,
    quality_rating: typeof qualityRating === 'number' ? qualityRating : null,
    communication_rating: typeof communicationRating === 'number' ? communicationRating : null,
    comment: comment?.trim() || null,
  })

  if (insertErr) return { error: insertErr.message }

  revalidatePath(`/retailer/orders/${orderId}`)
  revalidatePath('/retailer/browse')
  return { error: null }
}

export type SupplierReviewRow = {
  id: string
  overall_rating: number
  delivery_rating: number | null
  quality_rating: number | null
  communication_rating: number | null
  comment: string | null
  created_at: string
  retailer_name: string
}

export async function getSupplierReviews(
  supplierId: string,
  page: number = 1,
  pageSize: number = 10,
): Promise<{ reviews: SupplierReviewRow[]; total: number; error: string | null }> {
  const supabase = supabaseServer()

  const { count, error: countErr } = await supabase
    .from('supplier_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('supplier_id', supplierId)
  if (countErr) return { reviews: [], total: 0, error: countErr.message }

  const total = count ?? 0
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data: rows, error } = await supabase
    .from('supplier_reviews')
    .select('id, overall_rating, delivery_rating, quality_rating, communication_rating, comment, created_at, retailer_id')
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return { reviews: [], total, error: error.message }

  const retailerIds = [...new Set((rows ?? []).map((r) => r.retailer_id))]
  const { data: profiles } = retailerIds.length > 0
    ? await supabase.from('profiles').select('user_id, business_name, name').in('user_id', retailerIds)
    : { data: [] as { user_id: string; business_name: string | null; name: string | null }[] }

  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]))

  const reviews: SupplierReviewRow[] = (rows ?? []).map((r) => {
    const p = profileMap.get(r.retailer_id)
    return {
      id: r.id,
      overall_rating: r.overall_rating,
      delivery_rating: r.delivery_rating,
      quality_rating: r.quality_rating,
      communication_rating: r.communication_rating,
      comment: r.comment,
      created_at: r.created_at,
      retailer_name: p?.business_name ?? p?.name ?? 'Retailer',
    }
  })

  return { reviews, total, error: null }
}
