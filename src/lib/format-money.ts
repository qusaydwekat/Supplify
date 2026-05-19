export function formatMoney(n: number, currencyCode: string = 'USD') {
  return new Intl.NumberFormat('ar', { style: 'currency', currency: currencyCode }).format(n)
}

export const formatLedgerMoney = formatMoney
