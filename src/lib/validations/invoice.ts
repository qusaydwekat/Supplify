import { z } from 'zod'

export const createInvoiceFromOrderSchema = z.object({
  orderId: z.string().uuid(),
  notes: z.string().optional().or(z.literal('')),
  dueInDays: z.coerce.number().int().min(1).max(365).default(14),
})

export type CreateInvoiceFromOrderInput = z.infer<typeof createInvoiceFromOrderSchema>
