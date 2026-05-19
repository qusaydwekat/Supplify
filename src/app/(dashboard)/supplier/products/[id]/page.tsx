import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { supabaseServer } from '@/lib/supabase/server'
import { ProductForm } from '@/components/products/product-form'
import type { VariationRow } from '@/components/products/variations-table'

export default async function SupplierProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations('ProductForm')
  const { id } = await params
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  if (!supplier) redirect('/retailer')

  const { data: product, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle()
  if (error || !product) notFound()
  if (product.supplier_id !== supplier.id) notFound()

  const { data: variationRows } = await supabase
    .from('product_variations')
    .select('id, name, sku, cost_price, price, stock_quantity, min_order_quantity, is_active')
    .eq('product_id', id)
    .order('created_at', { ascending: true })

  const variations: VariationRow[] = (variationRows ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    sku: v.sku,
    cost_price: Number((v as { cost_price?: number }).cost_price ?? 0),
    price: Number(v.price),
    stock_quantity: Number(v.stock_quantity),
    min_order_quantity: Number(v.min_order_quantity),
    is_active: v.is_active ?? true,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t('editTitle')}</h1>
        <p className="mt-1 text-sm text-slate-600">{product.name}</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <ProductForm
          mode="edit"
          product={{
            id: product.id,
            name: product.name,
            description: product.description,
            category: product.category,
            image_url: product.image_url,
            has_variations: product.has_variations ?? false,
            is_active: product.is_active ?? true,
          }}
          variations={variations}
        />
      </div>
    </div>
  )
}
