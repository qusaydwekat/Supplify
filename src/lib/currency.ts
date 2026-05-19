import type { SupabaseClient } from "@supabase/supabase-js";

/** ISO 4217 codes allowed for supplier storefront, invoices, and payments. ILS is shown as NIS in the UI. */
export const SUPPORTED_SUPPLIER_CURRENCIES = ["ILS", "USD", "JOD"] as const;
export type SupportedSupplierCurrency =
  (typeof SUPPORTED_SUPPLIER_CURRENCIES)[number];

const DISPLAY_LABEL: Record<SupportedSupplierCurrency, string> = {
  ILS: "NIS",
  USD: "USD",
  JOD: "JOD",
};

/** Short label for selects (NIS for Israeli shekel / ILS). */
export function currencyDisplayLabel(code: string): string {
  const u = code.trim().toUpperCase();
  if (u === "ILS") return DISPLAY_LABEL.ILS;
  const parsed = parseSupportedSupplierCurrency(u);
  return parsed ? DISPLAY_LABEL[parsed] : u;
}

export function parseSupportedSupplierCurrency(
  code: string
): SupportedSupplierCurrency | null {
  const u = code.trim().toUpperCase();
  return (SUPPORTED_SUPPLIER_CURRENCIES as readonly string[]).includes(u)
    ? (u as SupportedSupplierCurrency)
    : null;
}

export type CurrencyConversionState = {
  defaultCurrency: string;
  toDefault: Map<string, number>;
};

export async function loadCurrencyConversionState(
  supabase: SupabaseClient
): Promise<CurrencyConversionState | { error: string }> {
  const { data: settings, error: sErr } = await supabase
    .from("app_settings")
    .select("default_currency")
    .eq("id", 1)
    .maybeSingle();
  if (sErr) return { error: sErr.message };

  const { data: rates, error: rErr } = await supabase
    .from("currency_rates")
    .select("currency_code, to_default_multiplier");
  if (rErr) return { error: rErr.message };

  const defaultCurrency = String(
    settings?.default_currency ?? "USD"
  ).toUpperCase();
  const toDefault = new Map<string, number>();
  for (const row of rates ?? []) {
    const code = String(
      (row as { currency_code: string }).currency_code
    ).toUpperCase();
    toDefault.set(
      code,
      Number((row as { to_default_multiplier: number }).to_default_multiplier)
    );
  }
  if (!toDefault.has(defaultCurrency)) {
    toDefault.set(defaultCurrency, 1);
  }
  return { defaultCurrency, toDefault };
}

export function getMultiplierToDefault(
  currency: string,
  state: CurrencyConversionState
): number | null {
  return state.toDefault.get(currency.toUpperCase()) ?? null;
}

/** 1 unit of `from` equals `return` units of `to` (both non-default OK via default hub). */
export function convertBetween(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  state: CurrencyConversionState
): number {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to) return roundMoney2(amount);
  const mf = state.toDefault.get(from);
  const mt = state.toDefault.get(to);
  if (mf == null || mt == null || mt === 0) {
    throw new Error(`Missing exchange rate for ${from} or ${to}`);
  }
  return roundMoney2((amount * mf) / mt);
}

export function amountInDefaultCurrency(
  amount: number,
  paymentCurrency: string,
  state: CurrencyConversionState
): number {
  const m = getMultiplierToDefault(paymentCurrency, state);
  if (m == null)
    throw new Error(`Missing exchange rate for ${paymentCurrency}`);
  return roundMoney2(amount * m);
}

export function roundMoney2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Build conversion state from JSON-safe rates (e.g. on the client). */
export function buildConversionStateFromRates(
  defaultCurrency: string,
  rates: Record<string, number>
): CurrencyConversionState {
  const toDefault = new Map<string, number>();
  for (const [k, v] of Object.entries(rates)) {
    toDefault.set(k.toUpperCase(), Number(v));
  }
  return { defaultCurrency: defaultCurrency.toUpperCase(), toDefault };
}
