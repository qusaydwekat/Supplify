import { z } from "zod";

export const cartItemSchema = z.object({
  variationId: z.string().uuid(),
  productId: z.string().uuid(),
  supplierId: z.string().uuid(),
  productName: z.string().min(1),
  variationName: z.string().nullable().optional(),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});

export const createOrderPayloadSchema = z.object({
  items: z.array(cartItemSchema).min(1),
  supplierId: z.string().uuid(),
  notes: z.string().optional().or(z.literal("")),
  isCod: z.boolean().optional().default(false),
});

export type CreateOrderPayload = z.infer<typeof createOrderPayloadSchema>;

export const orderStatuses = [
  "pending",
  "accepted",
  "modified",
  "rejected",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export const modifyOrderLineSchema = z.object({
  orderItemId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});

export const modifyOrderPayloadSchema = z.object({
  orderId: z.string().uuid(),
  lines: z.array(modifyOrderLineSchema).min(1),
});
