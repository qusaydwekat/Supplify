import { z } from 'zod'

export const profileSchema = z.object({
  name: z.string().min(1),
  business_name: z.string().min(1),
  phone: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  tax_id: z.string().optional().or(z.literal('')),
  commercial_registration: z.string().optional().or(z.literal('')),
  vat_registered: z.boolean().optional().default(false),
  prefer_hijri: z.boolean().optional().default(false),
})

export type ProfileInput = z.infer<typeof profileSchema>
