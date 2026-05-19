import { z } from 'zod'
import { parseSupportedSupplierCurrency } from '@/lib/currency'

export const paymentMethods = ['cash', 'bank', 'cheque', 'other'] as const

function parseIsoDateOnly(s: string): Date | null {
  const t = Date.parse(`${s.trim()}T12:00:00`)
  return Number.isNaN(t) ? null : new Date(t)
}

/** Base shape without refinements — required so update schema can extend without `.omit()` on a refined schema (Zod 4). */
export const paymentFieldsSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentCurrency: z
    .string()
    .length(3)
    .transform((s) => s.toUpperCase())
    .refine((s) => parseSupportedSupplierCurrency(s) !== null, 'Unsupported payment currency'),
  method: z.enum(paymentMethods),
  referenceNote: z.string().optional().or(z.literal('')),
  chequeNumber: z.string().optional().or(z.literal('')),
  chequeBankId: z.string().optional().or(z.literal('')),
  chequeBranchId: z.string().optional().or(z.literal('')),
  chequeDate: z.string().optional().or(z.literal('')),
  withholdingAmount: z.coerce.number().min(0).optional(),
  withholdingReference: z.string().optional().or(z.literal('')),
})

function applyChequePaymentRefinement(
  data: {
    method: string
    chequeNumber?: string | null
    chequeBankId?: string | null
    chequeBranchId?: string | null
    chequeDate?: string | null
  },
  ctx: z.RefinementCtx,
) {
  if (data.method !== 'cheque') return

  const reqText = (field: 'chequeNumber' | 'chequeDate', label: string) => {
    const v = data[field]?.trim() ?? ''
    if (!v) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `${label} is required for cheque payments`,
      })
    }
  }

  reqText('chequeNumber', 'Cheque number')
  reqText('chequeDate', 'Cheque date')

  const bankId = data.chequeBankId?.trim() ?? ''
  const branchId = data.chequeBranchId?.trim() ?? ''
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  if (!bankId || !uuidRe.test(bankId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['chequeBankId'],
      message: 'Bank is required for cheque payments',
    })
  }
  if (!branchId || !uuidRe.test(branchId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['chequeBranchId'],
      message: 'Branch is required for cheque payments',
    })
  }

  const dStr = data.chequeDate?.trim() ?? ''
  if (!dStr) return
  const d = parseIsoDateOnly(dStr)
  if (!d) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['chequeDate'],
      message: 'Enter a valid cheque date',
    })
  }
}

export const recordPaymentSchema = paymentFieldsSchema
  .extend({
    invoiceId: z.string().uuid(),
  })
  .superRefine(applyChequePaymentRefinement)

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>

export const updatePaymentSchema = paymentFieldsSchema
  .extend({
    paymentId: z.string().uuid(),
  })
  .superRefine(applyChequePaymentRefinement)

export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>

export const deletePaymentSchema = z.object({
  paymentId: z.string().uuid(),
})

export type DeletePaymentInput = z.infer<typeof deletePaymentSchema>
