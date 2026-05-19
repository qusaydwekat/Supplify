/**
 * Live FX: fetch USD-based quotes from public APIs and compute
 * `to_default_multiplier` for currency_rates (amount in currency × mult → global price currency).
 */

import { SUPPORTED_SUPPLIER_CURRENCIES, type SupportedSupplierCurrency } from '@/lib/currency'

const OPEN_ER = 'https://open.er-api.com/v6/latest/USD'
const FRANKFURTER = 'https://api.frankfurter.app/v1/latest'

export type MarketRatesFetchResult = {
  /** ISO date from provider when available */
  rateDate: string | null
  /** Provider id for audit/display */
  source: string
  /** Multipliers for each supported currency into defaultCurrency */
  multipliers: Record<SupportedSupplierCurrency, number>
}

function roundRate(n: number): number {
  return Math.round(n * 1e8) / 1e8
}

/**
 * From USD-denominated quotes: `units_of_X_per_1_USD` (e.g. ILS 3.65, JOD 0.709).
 * Multiplier into default D: mult(X) = units_of_D_per_1_USD / units_of_X_per_1_USD
 */
export function multipliersFromUsdRates(
  unitsPerUsd: Record<string, number>,
  defaultCurrency: string,
): Record<SupportedSupplierCurrency, number> {
  const D = defaultCurrency.trim().toUpperCase()
  const dPerUsd = unitsPerUsd[D]
  if (dPerUsd == null || dPerUsd === 0) {
    throw new Error(`Missing or zero USD rate for default currency ${D}`)
  }
  const out = {} as Record<SupportedSupplierCurrency, number>
  for (const code of SUPPORTED_SUPPLIER_CURRENCIES) {
    const xPerUsd = unitsPerUsd[code]
    if (xPerUsd == null || xPerUsd === 0) {
      throw new Error(`Missing live rate for ${code}`)
    }
    out[code] = roundRate(dPerUsd / xPerUsd)
  }
  return out
}

async function fetchJson(url: string, timeoutMs = 15000): Promise<unknown> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

/** Primary: open.er-api (broad currency coverage, no API key). */
async function fetchOpenErUsdRates(): Promise<{ unitsPerUsd: Record<string, number>; rateDate: string | null }> {
  const raw = (await fetchJson(OPEN_ER)) as {
    result?: string
    time_last_update_utc?: string
    rates?: Record<string, number>
    conversion_rates?: Record<string, number>
    error?: string
  }
  const table = raw.rates ?? raw.conversion_rates
  if (raw.result !== 'success' || !table) {
    throw new Error(raw.error ?? 'open.er-api returned no rates')
  }
  return {
    unitsPerUsd: table,
    rateDate: raw.time_last_update_utc ?? null,
  }
}

/** Fallback: Frankfurter (ECB), USD base — smaller currency set. */
async function fetchFrankfurterUsdRates(): Promise<{ unitsPerUsd: Record<string, number>; rateDate: string | null }> {
  const symbols = SUPPORTED_SUPPLIER_CURRENCIES.filter((c) => c !== 'USD').join(',')
  const raw = (await fetchJson(`${FRANKFURTER}?from=USD&to=${symbols}`)) as {
    amount?: number
    base?: string
    date?: string
    rates?: Record<string, number>
  }
  if (!raw.rates || raw.base !== 'USD') {
    throw new Error('Frankfurter returned unexpected payload')
  }
  const unitsPerUsd: Record<string, number> = { USD: 1, ...raw.rates }
  return { unitsPerUsd, rateDate: raw.date ?? null }
}

/**
 * Fetch live multipliers for all supported storefront currencies into `defaultCurrency`.
 */
export async function fetchMarketMultipliers(defaultCurrency: string): Promise<MarketRatesFetchResult> {
  const D = defaultCurrency.trim().toUpperCase()
  if (!SUPPORTED_SUPPLIER_CURRENCIES.includes(D as SupportedSupplierCurrency)) {
    throw new Error(`Default currency must be one of: ${SUPPORTED_SUPPLIER_CURRENCIES.join(', ')}`)
  }

  let unitsPerUsd: Record<string, number>
  let rateDate: string | null
  let source: string

  try {
    const o = await fetchOpenErUsdRates()
    unitsPerUsd = o.unitsPerUsd
    rateDate = o.rateDate
    source = 'open.er-api (USD)'
  } catch {
    const f = await fetchFrankfurterUsdRates()
    unitsPerUsd = f.unitsPerUsd
    rateDate = f.rateDate
    source = 'Frankfurter (ECB / USD)'
  }

  const multipliers = multipliersFromUsdRates(unitsPerUsd, D)
  return { multipliers, rateDate, source }
}
