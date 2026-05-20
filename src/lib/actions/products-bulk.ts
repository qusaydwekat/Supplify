'use server'

import { revalidatePath } from 'next/cache'
import { getSupplierActionContext } from '@/lib/supplier/access'
import { isMarketplaceCategorySlug } from '@/lib/supplier-marketplace-categories'

async function getSupplierId() {
  const result = await getSupplierActionContext({ requireCatalog: true })
  if (result.error || !result.ctx) {
    return { error: result.error ?? 'Unauthorized' as const, supplierId: null, supabase: null }
  }
  return { error: null, supplierId: result.ctx.supplierId, supabase: result.ctx.supabase }
}

async function assertOwnProducts(supabase: NonNullable<Awaited<ReturnType<typeof getSupplierId>>['supabase']>, supplierId: string, ids: string[]) {
  if (!ids.length) return { ok: false as const, error: 'No products selected' }
  const { data, error } = await supabase.from('products').select('id').eq('supplier_id', supplierId).in('id', ids)
  if (error) return { ok: false as const, error: error.message }
  if ((data ?? []).length !== ids.length) return { ok: false as const, error: 'One or more products not found' }
  return { ok: true as const }
}

export async function bulkSetProductsActive(productIds: string[], isActive: boolean) {
  const ctx = await getSupplierId()
  if (ctx.error || !ctx.supplierId || !ctx.supabase) return { error: ctx.error ?? 'Unauthorized' }

  const check = await assertOwnProducts(ctx.supabase, ctx.supplierId, productIds)
  if (!check.ok) return { error: check.error }

  const { error } = await ctx.supabase
    .from('products')
    .update({
      is_active: isActive,
      catalog_status: isActive ? 'published' : 'archived',
      updated_at: new Date().toISOString(),
    })
    .in('id', productIds)

  if (error) return { error: error.message }
  revalidatePath('/supplier/products')
  return { error: null, count: productIds.length }
}

export async function bulkSetProductsCategory(productIds: string[], category: string) {
  const ctx = await getSupplierId()
  if (ctx.error || !ctx.supplierId || !ctx.supabase) return { error: ctx.error ?? 'Unauthorized' }

  if (category && !isMarketplaceCategorySlug(category)) {
    return { error: 'Invalid category' }
  }

  const check = await assertOwnProducts(ctx.supabase, ctx.supplierId, productIds)
  if (!check.ok) return { error: check.error }

  const { error } = await ctx.supabase
    .from('products')
    .update({
      marketplace_category: category || null,
      updated_at: new Date().toISOString(),
    })
    .in('id', productIds)

  if (error) return { error: error.message }
  revalidatePath('/supplier/products')
  return { error: null, count: productIds.length }
}
