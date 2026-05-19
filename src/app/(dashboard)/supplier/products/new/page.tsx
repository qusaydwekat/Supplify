import { getTranslations } from 'next-intl/server'
import { ProductForm } from '@/components/products/product-form'

export default async function SupplierNewProductPage() {
  const t = await getTranslations('ProductForm')
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t('newTitle')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('newSubtitle')}</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <ProductForm mode="create" />
      </div>
    </div>
  )
}
