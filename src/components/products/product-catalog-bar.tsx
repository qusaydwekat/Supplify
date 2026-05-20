'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { duplicateProduct, setProductCatalogStatus } from '@/lib/actions/products-catalog'
import type { ProductCatalogStatus } from '@/lib/types/products'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  productId: string
  catalogStatus: ProductCatalogStatus
}

const STATUS_STYLE: Record<ProductCatalogStatus, string> = {
  draft: 'bg-slate-200 text-slate-800',
  published: 'bg-emerald-100 text-emerald-800',
  archived: 'bg-amber-100 text-amber-900',
}

export function ProductCatalogBar({ productId, catalogStatus }: Props) {
  const t = useTranslations('ProductCatalog')
  const router = useRouter()

  async function setStatus(status: ProductCatalogStatus) {
    const res = await setProductCatalogStatus(productId, status)
    if (res.error === 'PUBLISH_INCOMPLETE') {
      const missing = res.missingKeys?.map((k) => t(`check_${k}`)).join(', ') ?? ''
      toast.error(t('publishIncompleteError', { score: res.score ?? 0, missing }))
      return
    }
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t(`statusSuccess_${status}`))
    router.refresh()
  }

  async function onDuplicate() {
    const res = await duplicateProduct(productId)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('duplicateSuccess'))
    if (res.newProductId) router.push(`/supplier/products/${res.newProductId}`)
    else router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">{t('catalogStatus')}</span>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_STYLE[catalogStatus])}>
          {t(`status_${catalogStatus}`)}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {catalogStatus !== 'draft' ? (
          <Button type="button" className="h-8 min-h-8 px-3 text-xs" variant="secondary" onClick={() => void setStatus('draft')}>
            {t('actionDraft')}
          </Button>
        ) : null}
        {catalogStatus !== 'published' ? (
          <Button type="button" className="h-8 min-h-8 px-3 text-xs" onClick={() => void setStatus('published')}>
            {t('actionPublish')}
          </Button>
        ) : null}
        {catalogStatus !== 'archived' ? (
          <Button type="button" className="h-8 min-h-8 px-3 text-xs" variant="secondary" onClick={() => void setStatus('archived')}>
            {t('actionArchive')}
          </Button>
        ) : null}
        <Button type="button" className="h-8 min-h-8 px-3 text-xs" variant="ghost" onClick={() => void onDuplicate()}>
          {t('actionDuplicate')}
        </Button>
      </div>
    </div>
  )
}
