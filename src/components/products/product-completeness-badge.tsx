import { getTranslations } from 'next-intl/server'
import { calcProductCompleteness, completenessTone } from '@/lib/products/completeness'
import type { ProductCatalogStatus } from '@/lib/types/products'
import { cn } from '@/lib/utils'

type Props = {
  name: string
  description: string | null
  marketplaceCategory: string | null
  imageUrl: string | null
  galleryCount: number
  catalogStatus: ProductCatalogStatus
  variations: {
    sku: string | null
    price: number
    stock_quantity: number
    is_active: boolean
  }[]
  showMissing?: boolean
  compact?: boolean
}

export async function ProductCompletenessBadge({
  name,
  description,
  marketplaceCategory,
  imageUrl,
  galleryCount,
  catalogStatus,
  variations,
  showMissing = false,
  compact = false,
}: Props) {
  const t = await getTranslations('ProductCatalog')
  const { score, missingKeys } = calcProductCompleteness({
    name,
    description,
    marketplaceCategory,
    imageUrl,
    galleryCount,
    catalogStatus,
    variations,
  })
  const tone = completenessTone(score)

  return (
    <div className={cn('space-y-1', compact && 'space-y-0')}>
      <div
        className={cn(
          'inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-xs font-semibold',
          tone === 'high' && 'bg-emerald-100 text-emerald-800',
          tone === 'mid' && 'bg-amber-100 text-amber-900',
          tone === 'low' && 'bg-red-100 text-red-800',
        )}
        title={t('completenessTitle')}
      >
        <span>{t('completenessLabel')}</span>
        <span className="tabular-nums">{score}%</span>
      </div>
      {showMissing && missingKeys.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t('completenessMissing')}: {missingKeys.map((k) => t(`check_${k}`)).join(', ')}
        </p>
      ) : null}
    </div>
  )
}
