import { z } from 'zod'

type V = (key: string) => string

const defaults: Record<string, string> = {
  ratingRequired: 'Rating is required',
  ratingRange: 'Rating must be between 1 and 5',
  commentTooLong: 'Comment must be 500 characters or less',
  orderIdRequired: 'Order is required',
}

function v(t: V | undefined, key: string): string {
  if (t) try { return t(key) } catch { /* fallback */ }
  return defaults[key] ?? key
}

const ratingField = (t: V | undefined) =>
  z.coerce
    .number({ message: v(t, 'ratingRequired') })
    .int()
    .min(1, v(t, 'ratingRange'))
    .max(5, v(t, 'ratingRange'))

const optionalRating = () =>
  z.coerce.number().int().min(1).max(5).optional().or(z.literal('').transform(() => undefined))

export function createReviewSchema(t?: V) {
  return z.object({
    orderId: z.string().min(1, v(t, 'orderIdRequired')),
    overallRating: ratingField(t),
    deliveryRating: optionalRating(),
    qualityRating: optionalRating(),
    communicationRating: optionalRating(),
    comment: z.string().max(500, v(t, 'commentTooLong')).optional().or(z.literal('')),
  })
}

export const reviewSchema = createReviewSchema()
export type ReviewInput = z.infer<typeof reviewSchema>
