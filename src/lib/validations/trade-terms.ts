import { z } from 'zod'

export const upsertTradeTermsSchema = z.object({
  retailerId: z.string().uuid(),
  creditLimit: z.string().nullable().optional(),
  paymentTermsDays: z.coerce.number().int().min(1).max(365),
  graceDays: z.coerce.number().int().min(0).max(90),
  blocked: z.boolean(),
  creditEnforcementMode: z.enum(['block', 'warn']).optional(),
})

export type UpsertTradeTermsInput = z.infer<typeof upsertTradeTermsSchema>

export function parseUpsertTradeTerms(input: unknown) {
  const parsed = upsertTradeTermsSchema.safeParse(input)
  if (!parsed.success) return { success: false as const, error: parsed.error.message }

  const raw = (parsed.data.creditLimit ?? '').trim()
  let credit_limit: number | null = null
  if (raw !== '') {
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return { success: false as const, error: 'Credit limit must be a non-negative number or empty for no limit.' }
    credit_limit = Math.round(n * 100) / 100
  }

  return {
    success: true as const,
    data: {
      retailerId: parsed.data.retailerId,
      credit_limit,
      payment_terms_days: parsed.data.paymentTermsDays,
      grace_days: parsed.data.graceDays,
      blocked: parsed.data.blocked,
      credit_enforcement_mode: parsed.data.creditEnforcementMode ?? 'block',
    },
  }
}
