import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { supabaseServer } from '@/lib/supabase/server'
import { VariationsTable, type VariationRow } from '@/components/products/variations-table'

export default async function SupplierProductVariationsPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations('VariationsPage')
  const { id } = await params
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  if (!supplier) redirect('/retailer')

  const { data: productFull } = await supabase
    .from('products')
    .select('id, name, has_variations, supplier_id')
    .eq('id', id)
    .maybeSingle()

  if (!productFull || productFull.supplier_id !== supplier.id) notFound()

  if (!productFull.has_variations) {
    return (
      <div className="space-y-4">
        <Link
          href={`/supplier/products/${id}`}
          className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
        >
          ← {t('backToProduct')}
        </Link>
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h1 className="text-lg font-semibold">{t('title')}</h1>
          <p className="mt-2 text-sm text-slate-600">{t('singlePriceHint')}</p>
        </div>
      </div>
    )
  }

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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/supplier/products/${id}`}
            className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
          >
            ← {t('backToProduct')}
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-600">{productFull.name}</p>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <VariationsTable
          key={variations.map((v) => `${v.id}-${v.stock_quantity}-${v.price}-${v.cost_price}`).join('|')}
          productId={id}
          initialRows={variations}
        />
      </div>
    </div>
  )
}
