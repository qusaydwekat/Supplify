import { z } from 'zod'

export const expenseCreateSchema = z.object({
  category: z.string().min(1),
  amount: z.coerce.number().positive(),
  currency_code: z.string().length(3).optional(),
  description: z.string().optional(),
  expense_date: z.string().optional(),
})

export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>
