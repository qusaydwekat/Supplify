import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { requireRequestUserId } from '@/lib/auth/request-session'
import { getProductActivityInsights } from '@/lib/data/products/product-activity'
import { listProductImages } from '@/lib/data/products/gallery'
import { listProductMovements } from '@/lib/data/products/movements'
import { ProductActivityPanel } from '@/components/products/product-activity-panel'
import { ProductCatalogBar } from '@/components/products/product-catalog-bar'
import { ProductCompletenessBadge } from '@/components/products/product-completeness-badge'
import { ProductGalleryPanel } from '@/components/products/product-gallery-panel'
import { ProductForm } from '@/components/products/product-form'
import { ProductHubNav } from '@/components/products/product-hub-nav'
import { parseProductHubTab } from '@/lib/products/product-hub-tabs'
import { ProductStockPanel } from '@/components/products/product-stock-panel'
import { listProductAttributes } from '@/lib/data/products/attributes'
import { listPriceTiersForVariations } from '@/lib/data/products/price-tiers'
import { AttributeMatrixPanel } from '@/components/products/attribute-matrix-panel'
import type { VariationRow } from '@/components/products/variations-table'
import { resolveSupplierAccess } from '@/lib/supplier/access'
import { supabaseServer } from '@/lib/supabase/server'
import type { MarketplaceCategorySlug } from '@/lib/supplier-marketplace-categories'
import { isMarketplaceCategorySlug } from '@/lib/supplier-marketplace-categories'
import type { ProductCatalogStatus } from '@/lib/types/products'
import { cn } from '@/lib/utils'

type Search = { tab?: string }

export default async function SupplierProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Search>
}) {
  const t = await getTranslations('ProductHub')
  const tForm = await getTranslations('ProductForm')
  const { id } = await params
  const sp = await searchParams
  const tab = parseProductHubTab(sp.tab)
  await requireRequestUserId()
  const supabase = supabaseServer()
  const access = await resolveSupplierAccess()
  if (!access.access) redirect('/retailer')

  const { data: product, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle()
  if (error || !product) notFound()
  if (product.supplier_id !== access.access.supplierId) notFound()

  const { data: variationRows } = await supabase
    .from('product_variations')
    .select(
      'id, name, sku, cost_price, price, stock_quantity, min_order_quantity, reorder_point, reorder_qty, lead_time_days, is_active',
    )
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
    reorder_point: (v as { reorder_point?: number | null }).reorder_point ?? null,
    reorder_qty: (v as { reorder_qty?: number | null }).reorder_qty ?? null,
    lead_time_days: (v as { lead_time_days?: number | null }).lead_time_days ?? null,
    is_active: v.is_active ?? true,
  }))

  const rawCat = (product as { marketplace_category?: string | null }).marketplace_category
  const marketplaceCategory = isMarketplaceCategorySlug(rawCat ?? '') ? (rawCat as MarketplaceCategorySlug) : null

  const catalogStatus = ((product as { catalog_status?: ProductCatalogStatus }).catalog_status ??
    (product.is_active ? 'published' : 'draft')) as ProductCatalogStatus

  const variationIds = variations.map((v) => v.id)

  const [{ rows: movements }, activity, gallery, attributeData, tierMap] = await Promise.all([
    listProductMovements(id),
    tab === 'activity' ? getProductActivityInsights(id) : Promise.resolve({ rows: [], currencyCode: 'USD' }),
    tab === 'overview' ? listProductImages(id) : Promise.resolve({ rows: [] }),
    tab === 'skus' ? listProductAttributes(id) : Promise.resolve({ attributes: [], variationOptions: new Map() }),
    listPriceTiersForVariations(variationIds),
  ])

  const tiersByVariation = Object.fromEntries(tierMap.entries())

  const hasLowStock = variations.some(
    (v) => v.stock_quantity <= (v.reorder_point ?? Math.max(v.min_order_quantity * 2, 1)),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/supplier/products"
            className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            ← {tForm('backToList')}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{product.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                product.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700',
              )}
            >
              {product.is_active ? tForm('active') : t('inactiveLabel')}
            </span>
            {product.has_variations ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {t('multiSku')}
              </span>
            ) : null}
            {hasLowStock ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{t('lowStockBadge')}</span>
            ) : null}
            <ProductCompletenessBadge
              compact
              name={product.name}
              description={product.description}
              marketplaceCategory={marketplaceCategory}
              imageUrl={product.image_url}
              galleryCount={gallery.rows.length}
              catalogStatus={catalogStatus}
              variations={variations}
            />
          </div>
        </div>
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt=""
            className="h-20 w-20 rounded-lg border border-border object-cover shadow-sm"
          />
        ) : null}
      </div>

      <ProductCatalogBar productId={id} catalogStatus={catalogStatus} />

      <ProductHubNav productId={id} activeTab={tab} />

      {tab === 'overview' ? (
        <div className="space-y-6">
          <ProductGalleryPanel productId={id} initialImages={gallery.rows} />
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <ProductCompletenessBadge
              showMissing
              name={product.name}
              description={product.description}
              marketplaceCategory={marketplaceCategory}
              imageUrl={product.image_url}
              galleryCount={gallery.rows.length}
              catalogStatus={catalogStatus}
              variations={variations}
            />
            <div className="mt-6">
              <ProductForm
                mode="edit"
                hubView="overview"
                product={{
                  id: product.id,
                  name: product.name,
                  description: product.description,
                  category: product.category,
                  marketplace_category: marketplaceCategory,
                  image_url: product.image_url,
                  has_variations: product.has_variations ?? false,
                  is_active: product.is_active ?? true,
                }}
                variations={variations}
              />
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'skus' ? (
        <div className="space-y-6">
          <AttributeMatrixPanel productId={id} initialAttributes={attributeData.attributes} />
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <ProductForm
              mode="edit"
              hubView="skus"
              product={{
                id: product.id,
                name: product.name,
                description: product.description,
                category: product.category,
                marketplace_category: marketplaceCategory,
                image_url: product.image_url,
                has_variations: product.has_variations ?? false,
                is_active: product.is_active ?? true,
              }}
              variations={variations}
              tiersByVariation={tiersByVariation}
            />
          </div>
        </div>
      ) : null}

      {tab === 'stock' ? (
        <ProductStockPanel productId={id} variations={variations} movements={movements} />
      ) : null}

      {tab === 'activity' ? (
        <ProductActivityPanel rows={activity.rows} currencyCode={activity.currencyCode} productId={id} />
      ) : null}
    </div>
  )
}
