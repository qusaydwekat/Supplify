'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StarRating } from '@/components/ui/star-rating'
import { ReviewForm } from '@/components/reviews/review-form'

type ExistingReview = {
  overall_rating: number
  delivery_rating: number | null
  quality_rating: number | null
  communication_rating: number | null
  comment: string | null
  created_at: string
}

type Props = {
  orderId: string
  existingReview: ExistingReview | null
}

export function OrderReviewSection({ orderId, existingReview }: Props) {
  const t = useTranslations('Review')
  const [showForm, setShowForm] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
          <h2 className="text-sm font-semibold text-foreground">{t('yourReview')}</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t('thankYou')}</p>
      </section>
    )
  }

  if (existingReview) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
          <h2 className="text-sm font-semibold text-foreground">{t('yourReview')}</h2>
        </div>
        <div className="mt-3">
          <StarRating value={existingReview.overall_rating} readonly size="md" />
          {existingReview.comment && (
            <p className="mt-2 text-sm text-muted-foreground">{existingReview.comment}</p>
          )}
          {(existingReview.delivery_rating || existingReview.quality_rating || existingReview.communication_rating) && (
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
              {existingReview.delivery_rating ? (
                <span>{t('deliverySpeed')}: {existingReview.delivery_rating}/5</span>
              ) : null}
              {existingReview.quality_rating ? (
                <span>{t('productQuality')}: {existingReview.quality_rating}/5</span>
              ) : null}
              {existingReview.communication_rating ? (
                <span>{t('communication')}: {existingReview.communication_rating}/5</span>
              ) : null}
            </div>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t('rateOrder')}</h2>
        </div>
        {!showForm && (
          <Button variant="secondary" onClick={() => setShowForm(true)} className="text-xs">
            {t('rateOrder')}
          </Button>
        )}
      </div>
      {showForm && (
        <div className="mt-4">
          <ReviewForm orderId={orderId} onSubmitted={() => setSubmitted(true)} />
        </div>
      )}
    </section>
  )
}
