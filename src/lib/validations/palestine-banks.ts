import { z } from 'zod'

export const upsertPalestineBankSchema = z.object({
  id: z.string().uuid().optional(),
  nameEn: z.string().trim().min(1).max(200),
  nameAr: z.string().trim().max(200).optional().or(z.literal('')),
})

export const upsertPalestineBranchSchema = z.object({
  id: z.string().uuid().optional(),
  bankId: z.string().uuid(),
  branchNumber: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().min(1).max(300),
  nameAr: z.string().trim().max(300).optional().or(z.literal('')),
  city: z.string().trim().max(120).optional().or(z.literal('')),
  phone: z.string().trim().max(120).optional().or(z.literal('')),
})

export const deletePalestineBankSchema = z.object({
  id: z.string().uuid(),
})

export const deletePalestineBranchSchema = z.object({
  id: z.string().uuid(),
})
