'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { StarRating } from '@/components/ui/star-rating'
import { Button } from '@/components/ui/button'
import { submitReview } from '@/lib/actions/reviews'

type Props = {
  orderId: string
  onSubmitted?: () => void
}

export function ReviewForm({ orderId, onSubmitted }: Props) {
  const t = useTranslations('Review')
  const [overall, setOverall] = useState(0)
  const [delivery, setDelivery] = useState(0)
  const [quality, setQuality] = useState(0)
  const [communication, setCommunication] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (overall === 0) {
      toast.error(t('ratingRequired'))
      return
    }
    setSubmitting(true)
    const res = await submitReview({
      orderId,
      overallRating: overall,
      deliveryRating: delivery || undefined,
      qualityRating: quality || undefined,
      communicationRating: communication || undefined,
      comment: comment.trim() || undefined,
    })
    setSubmitting(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('success'))
    onSubmitted?.()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground">{t('overallRating')} *</label>
        <div className="mt-1">
          <StarRating value={overall} onChange={setOverall} size="lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">{t('deliverySpeed')}</label>
          <div className="mt-1">
            <StarRating value={delivery} onChange={setDelivery} size="sm" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">{t('productQuality')}</label>
          <div className="mt-1">
            <StarRating value={quality} onChange={setQuality} size="sm" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">{t('communication')}</label>
          <div className="mt-1">
            <StarRating value={communication} onChange={setCommunication} size="sm" />
          </div>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground" htmlFor="review-comment">
          {t('comment')}
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder={t('commentPlaceholder')}
          className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <p className="mt-1 text-end text-xs text-muted-foreground">{comment.length}/500</p>
      </div>

      <Button type="submit" disabled={submitting || overall === 0} className="w-full sm:w-auto">
        {submitting ? t('submitting') : t('submit')}
      </Button>
    </form>
  )
}
