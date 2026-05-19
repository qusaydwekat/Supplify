'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { syncMarketExchangeRatesJob } from '@/lib/exchange-rates/sync-market-rates-job'

const currencyCodeSchema = z.string().length(3).transform((s) => s.toUpperCase())

export async function adminSetDefaultCurrency(input: unknown): Promise<{ error: string | null }> {
  const parsed = z.object({ currencyCode: currencyCodeSchema }).safeParse(input)
  if (!parsed.success) return { error: 'Invalid currency code' }

  await requireAdmin()
  const db = supabaseServer()

  const { error } = await db
    .from('app_settings')
    .update({ default_currency: parsed.data.currencyCode })
    .eq('id', 1)

  if (error) return { error: error.message }

  revalidatePath('/admin')
  revalidatePath('/admin/currencies')
  revalidatePath('/supplier')
  revalidatePath('/retailer')
  return { error: null }
}

export async function adminUpsertCurrencyRate(input: unknown): Promise<{ error: string | null }> {
  const parsed = z
    .object({
      currencyCode: currencyCodeSchema,
      toDefaultMultiplier: z.coerce.number().positive(),
    })
    .safeParse(input)
  if (!parsed.success) return { error: 'Invalid rate data' }

  await requireAdmin()
  const db = supabaseServer()

  const { error } = await db.from('currency_rates').upsert(
    {
      currency_code: parsed.data.currencyCode,
      to_default_multiplier: parsed.data.toDefaultMultiplier,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'currency_code' },
  )

  if (error) return { error: error.message }

  revalidatePath('/admin')
  revalidatePath('/admin/currencies')
  revalidatePath('/supplier')
  revalidatePath('/retailer')
  return { error: null }
}

export async function adminSyncMarketExchangeRates(): Promise<{
  error: string | null
  detail?: string
  source?: string
  rateDate?: string | null
}> {
  await requireAdmin()
  const db = supabaseServer()

  const result = await syncMarketExchangeRatesJob(db)
  if (!result.ok) return { error: result.error }

  revalidatePath('/admin')
  revalidatePath('/admin/currencies')
  revalidatePath('/supplier')
  revalidatePath('/retailer')

  if (result.metaWarning) {
    return {
      error: null,
      detail: result.metaWarning,
      source: result.source,
      rateDate: result.rateDate,
    }
  }

  return { error: null, source: result.source, rateDate: result.rateDate }
}
