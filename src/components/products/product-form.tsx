'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  productCreateSchema,
  productUpdateSchema,
  type ProductCreateInput,
  type ProductUpdateInput,
} from '@/lib/validations/product'
import { createProduct, updateProduct, deleteProduct, uploadProductImage, updateVariation } from '@/lib/actions/products'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { VariationsTable, type VariationRow } from '@/components/products/variations-table'
import { MARKETPLACE_CATEGORY_SLUGS, type MarketplaceCategorySlug } from '@/lib/supplier-marketplace-categories'
import { isVariationLowStock } from '@/lib/types/products'
import { cn } from '@/lib/utils'

type ProductRow = {
  id: string
  name: string
  description: string | null
  category: string | null
  marketplace_category?: MarketplaceCategorySlug | null
  image_url: string | null
  has_variations: boolean
  is_active: boolean
}

type HubView = 'overview' | 'skus' | 'full'

type Props =
  | { mode: 'create' }
  | { mode: 'edit'; product: ProductRow; variations: VariationRow[]; hubView?: HubView; tiersByVariation?: Record<string, import('@/lib/pricing/resolve-unit-price').PriceTier[]> }

function ProductFormCreate() {
  const pf = useTranslations('ProductForm')
  const tCat = useTranslations('MarketplaceCategories')
  const router = useRouter()
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<ProductCreateInput>({
    resolver: zodResolver(productCreateSchema) as Resolver<ProductCreateInput>,
    defaultValues: {
      name: '',
      description: '',
      category: '',
      marketplace_category: '',
      image_url: '',
      has_variations: false,
      is_active: true,
      price: 0,
      cost_price: 0,
      stock_quantity: 0,
      min_order_quantity: 1,
      variations: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'variations',
  })

  const hasVariations = form.watch('has_variations')

  const onSubmit = form.handleSubmit(async (values) => {
    startTransition(async () => {
      const res = await createProduct(values)
      if (res.error || !res.product) {
        toast.error(res.error ?? pf('failed'))
        return
      }
      if (imageFile) {
        const fd = new FormData()
        fd.append('file', imageFile)
        const up = await uploadProductImage(res.product.id, fd)
        if (up.error) toast.error(up.error)
      }
      toast.success(pf('successCreated'))
      router.push(`/supplier/products/${res.product.id}`)
      router.refresh()
    })
  })

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-sm font-medium">{pf('name')}</label>
          <Input className="mt-1" {...form.register('name')} />
          {form.formState.errors.name && (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium">{pf('description')}</label>
          <textarea
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            rows={3}
            {...form.register('description')}
          />
        </div>
        <div>
          <label className="text-sm font-medium">{pf('category')}</label>
          <select
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            {...form.register('marketplace_category')}
          >
            <option value="">{pf('categoryNone')}</option>
            {MARKETPLACE_CATEGORY_SLUGS.map((slug) => (
              <option key={slug} value={slug}>
                {tCat(slug)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-6 pt-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register('has_variations')} />
            {pf('hasVariations')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register('is_active')} />
            {pf('active')}
          </label>
        </div>
      </div>

      {!hasVariations ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-sm font-medium">{pf('costPrice')}</label>
            <Input type="number" step="0.01" min={0} className="mt-1" {...form.register('cost_price')} />
            <p className="mt-1 text-xs text-slate-500">{pf('costPriceHint')}</p>
          </div>
          <div>
            <label className="text-sm font-medium">{pf('price')}</label>
            <Input type="number" step="0.01" min={0} className="mt-1" {...form.register('price')} />
          </div>
          <div>
            <label className="text-sm font-medium">{pf('stock')}</label>
            <Input type="number" min={0} className="mt-1" {...form.register('stock_quantity')} />
          </div>
          <div>
            <label className="text-sm font-medium">{pf('minOrder')}</label>
            <Input type="number" min={1} className="mt-1" {...form.register('min_order_quantity')} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{pf('variations')}</h3>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                append({
                  name: '',
                  sku: '',
                  cost_price: 0,
                  price: 0,
                  stock_quantity: 0,
                  min_order_quantity: 1,
                  is_active: true,
                })
              }
            >
              {pf('addRow')}
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-start">{pf('colName')}</th>
                  <th className="px-3 py-2 text-start">{pf('colSku')}</th>
                  <th className="px-3 py-2 text-end">{pf('colCost')}</th>
                  <th className="px-3 py-2 text-end">{pf('colPrice')}</th>
                  <th className="px-3 py-2 text-end">{pf('colStock')}</th>
                  <th className="px-3 py-2 text-end">{pf('colMin')}</th>
                  <th className="px-3 py-2 text-center">{pf('colActive')}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {fields.map((field, index) => (
                  <tr key={field.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Input className="h-8" {...form.register(`variations.${index}.name`)} />
                    </td>
                    <td className="px-3 py-2">
                      <Input className="h-8" {...form.register(`variations.${index}.sku`)} />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-end"
                        {...form.register(`variations.${index}.cost_price`, { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-end"
                        {...form.register(`variations.${index}.price`, { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        className="h-8 text-end"
                        {...form.register(`variations.${index}.stock_quantity`, { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        className="h-8 text-end"
                        {...form.register(`variations.${index}.min_order_quantity`, { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" {...form.register(`variations.${index}.is_active`)} />
                    </td>
                    <td className="px-3 py-2">
                      <Button type="button" variant="ghost" className="h-8" onClick={() => remove(index)}>
                        {pf('remove')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <label className="text-sm font-medium">{pf('productImage')}</label>
        <input
          type="file"
          accept="image/*"
          className="mt-1 block text-sm"
          onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
        />
        <p className="mt-1 text-xs text-slate-500">{pf('uploadAfterCreate')}</p>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? pf('saving') : pf('createProduct')}
        </Button>
        <Link href="/supplier/products">
          <Button type="button" variant="secondary">
            {pf('cancel')}
          </Button>
        </Link>
      </div>
    </form>
  )
}

function ProductFormEdit({
  product,
  variations,
  hubView = 'full',
  tiersByVariation = {},
}: {
  product: ProductRow
  variations: VariationRow[]
  hubView?: HubView
  tiersByVariation?: Record<string, import('@/lib/pricing/resolve-unit-price').PriceTier[]>
}) {
  const pf = useTranslations('ProductForm')
  const tCat = useTranslations('MarketplaceCategories')
  const router = useRouter()
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<ProductUpdateInput>({
    resolver: zodResolver(productUpdateSchema) as Resolver<ProductUpdateInput>,
    defaultValues: {
      name: product.name,
      description: product.description ?? '',
      category: product.category ?? '',
      marketplace_category: product.marketplace_category ?? '',
      image_url: product.image_url ?? '',
      has_variations: product.has_variations,
      is_active: product.is_active,
    },
  })

  const hasVariations = form.watch('has_variations')

  const singleVariation = !product.has_variations ? variations[0] : null

  const [singleV, setSingleV] = useState(() => ({
    name: singleVariation?.name ?? pf('defaultVariationName'),
    sku: singleVariation?.sku ?? '',
    cost_price: singleVariation?.cost_price ?? 0,
    price: singleVariation?.price ?? 0,
    stock_quantity: singleVariation?.stock_quantity ?? 0,
    min_order_quantity: singleVariation?.min_order_quantity ?? 1,
    reorder_point: (singleVariation?.reorder_point ?? 2) as number | null,
    reorder_qty: singleVariation?.reorder_qty ?? null,
    lead_time_days: singleVariation?.lead_time_days ?? null,
    is_active: singleVariation?.is_active ?? true,
  }))

  const onSubmit = form.handleSubmit(async (values) => {
    startTransition(async () => {
      const res = await updateProduct(product.id, values)
      if (res.error) {
        toast.error(res.error)
        return
      }
      if (imageFile) {
        const fd = new FormData()
        fd.append('file', imageFile)
        const up = await uploadProductImage(product.id, fd)
        if (up.error) toast.error(up.error)
      }
      toast.success(pf('successUpdated'))
      router.refresh()
    })
  })

  const saveSingleVariation = async () => {
    if (!singleVariation) return
    const res = await updateVariation(singleVariation.id, {
      id: singleVariation.id,
      name: singleV.name,
      sku: singleV.sku || null,
      cost_price: Number(singleV.cost_price),
      price: Number(singleV.price),
      stock_quantity: Number(singleV.stock_quantity),
      min_order_quantity: Number(singleV.min_order_quantity),
      reorder_point: singleV.reorder_point != null ? Number(singleV.reorder_point) : null,
      reorder_qty: singleV.reorder_qty != null ? Number(singleV.reorder_qty) : null,
      lead_time_days: singleV.lead_time_days != null ? Number(singleV.lead_time_days) : null,
      is_active: singleV.is_active,
    })
    if (res.error) toast.error(res.error)
    else {
      toast.success(pf('successVariationSaved'))
      router.refresh()
    }
  }

  const onDeleteProduct = async () => {
    if (!window.confirm(pf('deleteConfirm'))) return
    const res = await deleteProduct(product.id)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(pf('successDeleted'))
    router.push('/supplier/products')
    router.refresh()
  }

  const showOverview = hubView === 'full' || hubView === 'overview'
  const showSkus = hubView === 'full' || hubView === 'skus'

  return (
    <div className="space-y-8">
      {showOverview ? (
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">{pf('name')}</label>
            <Input className="mt-1" {...form.register('name')} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">{pf('description')}</label>
            <textarea
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              rows={3}
              {...form.register('description')}
            />
          </div>
          <div>
            <label className="text-sm font-medium">{pf('category')}</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              {...form.register('marketplace_category')}
            >
              <option value="">{pf('categoryNone')}</option>
              {MARKETPLACE_CATEGORY_SLUGS.map((slug) => (
                <option key={slug} value={slug}>
                  {tCat(slug)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-6 pt-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register('has_variations')} />
              {pf('hasVariations')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register('is_active')} />
              {pf('active')}
            </label>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">{pf('productImage')}</label>
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt="" className="mt-2 h-24 w-24 rounded-md border border-slate-200 object-cover" />
          ) : null}
          <input
            type="file"
            accept="image/*"
            className="mt-2 block text-sm"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? pf('saving') : pf('saveProduct')}
          </Button>
          <Link href="/supplier/products">
            <Button type="button" variant="secondary">
              {pf('backToList')}
            </Button>
          </Link>
          {hubView === 'full' ? (
            <Link href={`/supplier/products/${product.id}/variations`}>
              <Button type="button" variant="secondary">
                {pf('manageVariations')}
              </Button>
            </Link>
          ) : null}
          <Button type="button" variant="secondary" className="text-red-600" onClick={onDeleteProduct}>
            {pf('deleteProduct')}
          </Button>
        </div>
      </form>
      ) : null}

      {showSkus && hasVariations ? (
        <VariationsTable
          key={variations.map((v) => `${v.id}-${v.stock_quantity}-${v.price}-${v.cost_price}`).join('|')}
          productId={product.id}
          initialRows={variations}
          initialTiersByVariation={tiersByVariation}
        />
      ) : showSkus && singleVariation ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">{pf('defaultPriceStock')}</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-sm font-medium">{pf('label')}</label>
              <Input className="mt-1" value={singleV.name} onChange={(e) => setSingleV((s) => ({ ...s, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">{pf('sku')}</label>
              <Input
                className="mt-1"
                value={singleV.sku ?? ''}
                onChange={(e) => setSingleV((s) => ({ ...s, sku: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{pf('costPrice')}</label>
              <Input
                type="number"
                step="0.01"
                min={0}
                className="mt-1"
                value={singleV.cost_price}
                onChange={(e) => setSingleV((s) => ({ ...s, cost_price: Number(e.target.value) }))}
              />
              <p className="mt-1 text-xs text-slate-500">{pf('costPriceHint')}</p>
            </div>
            <div>
              <label className="text-sm font-medium">{pf('price')}</label>
              <Input
                type="number"
                step="0.01"
                className="mt-1"
                value={singleV.price}
                onChange={(e) => setSingleV((s) => ({ ...s, price: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{pf('stock')}</label>
              <Input
                type="number"
                className="mt-1"
                value={singleV.stock_quantity}
                onChange={(e) => setSingleV((s) => ({ ...s, stock_quantity: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{pf('minOrder')}</label>
              <Input
                type="number"
                min={1}
                className="mt-1"
                value={singleV.min_order_quantity}
                onChange={(e) => setSingleV((s) => ({ ...s, min_order_quantity: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{pf('reorderPoint')}</label>
              <Input
                type="number"
                min={0}
                className="mt-1"
                value={singleV.reorder_point ?? ''}
                onChange={(e) =>
                  setSingleV((s) => ({
                    ...s,
                    reorder_point: e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">{pf('leadTimeDays')}</label>
              <Input
                type="number"
                min={0}
                className="mt-1"
                value={singleV.lead_time_days ?? ''}
                onChange={(e) =>
                  setSingleV((s) => ({
                    ...s,
                    lead_time_days: e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={singleV.is_active}
                  onChange={(e) => setSingleV((s) => ({ ...s, is_active: e.target.checked }))}
                />
                {pf('active')}
              </label>
            </div>
          </div>
          <div className="mt-4">
            <Button type="button" onClick={saveSingleVariation}>
              {pf('savePricingStock')}
            </Button>
          </div>
          {isVariationLowStock(singleV.stock_quantity, singleV.min_order_quantity, singleV.reorder_point) && (
            <p className={cn('mt-3 text-sm text-amber-700')}>{pf('lowStockHint')}</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function ProductForm(props: Props) {
  if (props.mode === 'create') return <ProductFormCreate />
  return (
    <ProductFormEdit
      product={props.product}
      variations={props.variations}
      hubView={props.hubView}
      tiersByVariation={props.tiersByVariation}
    />
  )
}
