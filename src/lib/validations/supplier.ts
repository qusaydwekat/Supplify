import { z } from 'zod'
import { parseSupportedSupplierCurrency } from '@/lib/currency'
import { MARKETPLACE_CATEGORY_SLUGS } from '@/lib/supplier-marketplace-categories'

const marketplaceCategorySchema = z.enum(MARKETPLACE_CATEGORY_SLUGS)

export const supplierProfileSchema = z.object({
  description: z.string().optional().or(z.literal('')),
  delivery_areas: z.array(z.string().min(1)),
  logo_url: z.string().url().optional().or(z.literal('')),
  is_active: z.boolean(),
  currency_code: z
    .string()
    .length(3)
    .transform((s) => s.toUpperCase())
    .refine((s) => parseSupportedSupplierCurrency(s) !== null, 'Unsupported currency'),
  marketplace_categories: z.array(marketplaceCategorySchema).max(12),
})

export type SupplierProfileInput = z.infer<typeof supplierProfileSchema>
