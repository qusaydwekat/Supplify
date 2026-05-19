import { z } from 'zod'

export const manualLedgerEntrySchema = z.object({
  retailerId: z.string().min(1, 'Retailer is required'),
  type: z.enum(['credit_note', 'debit_note']),
  amount: z.coerce.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required').max(200),
})

export type ManualLedgerEntryInput = z.infer<typeof manualLedgerEntrySchema>

export const ledgerEntryNoteSchema = z.object({
  entryId: z.string().min(1),
  note: z.string().max(500),
})

export type LedgerEntryNoteInput = z.infer<typeof ledgerEntryNoteSchema>

export const updateManualLedgerEntrySchema = z.object({
  entryId: z.string().uuid(),
  retailerId: z.string().min(1, 'Retailer is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required').max(200),
})

export type UpdateManualLedgerEntryInput = z.infer<typeof updateManualLedgerEntrySchema>

export const deleteManualLedgerEntrySchema = z.object({
  entryId: z.string().uuid(),
})

export type DeleteManualLedgerEntryInput = z.infer<typeof deleteManualLedgerEntrySchema>
