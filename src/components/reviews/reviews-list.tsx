import { getTranslations, getLocale } from 'next-intl/server'
import { StarRating } from '@/components/ui/star-rating'
import { getSupplierReviews } from '@/lib/actions/reviews'
import { formatDateShort, normalizeAppLocale } from '@/lib/format-datetime'

type Props = {
  supplierId: string
  page?: number
}

export async function ReviewsList({ supplierId, page = 1 }: Props) {
  const t = await getTranslations('Review')
  const locale = normalizeAppLocale(await getLocale())
  const { reviews, total, error } = await getSupplierReviews(supplierId, page, 10)

  if (error) return null

  if (reviews.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">{t('noReviews')}</p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {t('basedOn', { count: total })}
      </p>
      <div className="divide-y divide-border">
        {reviews.map((r) => (
          <div key={r.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <StarRating value={r.overall_rating} readonly size="sm" />
              <span className="text-sm font-medium text-foreground">{r.retailer_name}</span>
              <span className="text-xs text-muted-foreground">
                {formatDateShort(r.created_at, locale)}
              </span>
            </div>
            {r.comment && (
              <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>
            )}
            {(r.delivery_rating || r.quality_rating || r.communication_rating) && (
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                {r.delivery_rating ? (
                  <span>{t('deliverySpeed')}: {r.delivery_rating}/5</span>
                ) : null}
                {r.quality_rating ? (
                  <span>{t('productQuality')}: {r.quality_rating}/5</span>
                ) : null}
                {r.communication_rating ? (
                  <span>{t('communication')}: {r.communication_rating}/5</span>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
