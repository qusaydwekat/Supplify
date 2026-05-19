import { z } from 'zod'

const variationShape = {
  name: z.string().min(1),
  sku: z.string().optional().nullable(),
  cost_price: z.coerce.number().min(0).optional().default(0),
  price: z.coerce.number().min(0),
  stock_quantity: z.coerce.number().int().min(0),
  min_order_quantity: z.coerce.number().int().min(1),
  is_active: z.boolean(),
} as const

function withPriceAtLeastCost<S extends z.ZodRawShape>(schema: z.ZodObject<S>) {
  return schema.superRefine((row, ctx) => {
    const r = row as { price: number; cost_price?: number }
    const cost = r.cost_price ?? 0
    if (r.price < cost) {
      ctx.addIssue({
        code: 'custom',
        message: 'Selling price must be at least equal to cost price',
        path: ['price'],
      })
    }
  })
}

/** Full variation row (e.g. table + optional id for new rows). */
export const variationRowSchema = withPriceAtLeastCost(
  z.object({
    ...variationShape,
    id: z.string().uuid().optional(),
  }),
)

export type VariationRowInput = z.infer<typeof variationRowSchema>

export const productCreateSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional().or(z.literal('')),
    category: z.string().optional().or(z.literal('')),
    image_url: z.union([z.string().url(), z.literal('')]).optional(),
    has_variations: z.boolean(),
    is_active: z.boolean(),
    price: z.coerce.number().min(0).optional(),
    cost_price: z.coerce.number().min(0).optional().default(0),
    stock_quantity: z.coerce.number().int().min(0).optional(),
    min_order_quantity: z.coerce.number().int().min(1).optional(),
    variations: z.array(variationRowSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.has_variations) {
      if (!data.variations?.length) {
        ctx.addIssue({ code: 'custom', message: 'Add at least one variation', path: ['variations'] })
      }
    } else {
      if (data.price === undefined) ctx.addIssue({ code: 'custom', path: ['price'], message: 'Required' })
      if (data.stock_quantity === undefined)
        ctx.addIssue({ code: 'custom', path: ['stock_quantity'], message: 'Required' })
      if (data.min_order_quantity === undefined)
        ctx.addIssue({ code: 'custom', path: ['min_order_quantity'], message: 'Required' })
      const cost = data.cost_price ?? 0
      const price = data.price ?? 0
      if (price < cost) {
        ctx.addIssue({
          code: 'custom',
          path: ['price'],
          message: 'Selling price must be at least equal to cost price',
        })
      }
    }
  })

export type ProductCreateInput = z.infer<typeof productCreateSchema>

export const productUpdateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().or(z.literal('')),
  category: z.string().optional().or(z.literal('')),
  image_url: z.union([z.string().url(), z.literal('')]).optional(),
  has_variations: z.boolean(),
  is_active: z.boolean(),
})

export type ProductUpdateInput = z.infer<typeof productUpdateSchema>

export const variationCreateSchema = withPriceAtLeastCost(z.object({ ...variationShape }))

export const variationUpdateSchema = withPriceAtLeastCost(
  z.object({
    ...variationShape,
    id: z.string().uuid(),
  }),
)

export const adjustStockSchema = z.object({
  variationId: z.string().uuid(),
  delta: z.coerce.number().int(),
  reason: z.string().optional(),
})
