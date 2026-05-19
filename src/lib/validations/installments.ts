import { z } from 'zod'

export const installmentScheduleSchema = z.object({
  invoiceId: z.string().uuid(),
  rows: z
    .array(
      z.object({
        dueDate: z.string().min(1),
        amountDue: z.coerce.number().positive(),
      }),
    )
    .min(1),
})

export type InstallmentScheduleInput = z.infer<typeof installmentScheduleSchema>
