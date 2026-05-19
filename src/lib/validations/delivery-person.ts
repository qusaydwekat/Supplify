import { z } from 'zod'

export const deliveryPersonSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be under 100 characters')
    .trim(),

  phone: z
    .string()
    .min(7, 'Phone number is too short')
    .max(20, 'Phone number is too long')
    .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/, 'Enter a valid phone number')
    .trim(),

  notes: z.union([z.string().max(300, 'Notes must be under 300 characters'), z.literal('')]).optional(),

  is_active: z.boolean(),
})

export type DeliveryPersonFormValues = z.infer<typeof deliveryPersonSchema>

export const assignDeliveryPersonSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  deliveryPersonId: z.string().uuid('Please select a delivery person'),
})

export type AssignDeliveryPersonValues = z.infer<typeof assignDeliveryPersonSchema>
