/** Strip characters that break react-pdf layout (bidi marks, em dashes). */
export function pdfSafeText(value: string | null | undefined): string {
  if (value == null || value === '') return '-'
  const cleaned = value
    .replace(/[\u2066\u2067\u2068\u2069\u200e\u200f]/g, '')
    .replace(/\u2014/g, '-')
    .replace(/\u00a0/g, ' ')
    .trim()
  return cleaned || '-'
}
