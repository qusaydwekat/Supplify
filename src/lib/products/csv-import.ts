import { isMarketplaceCategorySlug } from '@/lib/supplier-marketplace-categories'

export type CsvImportRow = {
  product_name: string
  marketplace_category: string | null
  is_active: boolean
  variation_name: string
  sku: string | null
  cost_price: number
  price: number
  stock_quantity: number
  min_order_quantity: number
  reorder_point: number | null
  reorder_qty: number | null
}

export type CsvImportProductGroup = {
  productName: string
  marketplaceCategory: string | null
  isActive: boolean
  variations: CsvImportRow[]
}

export type CsvParseResult =
  | { ok: true; groups: CsvImportProductGroup[]; rowCount: number }
  | { ok: false; error: string }

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuotes = false
      } else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

function parseBool(raw: string): boolean {
  const v = raw.trim().toLowerCase()
  return v === 'yes' || v === 'true' || v === '1'
}

function parseNum(raw: string, fallback = 0): number {
  const n = Number(raw.trim())
  return Number.isFinite(n) ? n : fallback
}

function parseOptionalInt(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

const EXPECTED_HEADERS = [
  'product_name',
  'marketplace_category',
  'is_active',
  'variation_name',
  'sku',
  'cost_price',
  'price',
  'stock_quantity',
  'min_order_quantity',
  'reorder_point',
  'reorder_qty',
] as const

export function parseProductsCsv(text: string): CsvParseResult {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return { ok: false, error: 'CSV is empty' }

  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const headerOk = EXPECTED_HEADERS.every((h, i) => header[i] === h)
  if (!headerOk) {
    return {
      ok: false,
      error: 'Invalid CSV header. Export a template from the products page and edit that file.',
    }
  }

  const rows: CsvImportRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    if (cols.every((c) => !c.trim())) continue

    const productName = cols[0]?.trim() ?? ''
    const variationName = cols[3]?.trim() ?? ''
    if (!productName) return { ok: false, error: `Row ${i + 1}: product_name is required` }
    if (!variationName) return { ok: false, error: `Row ${i + 1}: variation_name is required` }

    const categoryRaw = cols[1]?.trim() ?? ''
    const marketplaceCategory =
      categoryRaw && isMarketplaceCategorySlug(categoryRaw) ? categoryRaw : categoryRaw || null

    const price = parseNum(cols[6])
    const cost = parseNum(cols[5])
    if (price < cost) {
      return { ok: false, error: `Row ${i + 1}: price must be >= cost_price` }
    }

    rows.push({
      product_name: productName,
      marketplace_category: marketplaceCategory,
      is_active: parseBool(cols[2] ?? 'yes'),
      variation_name: variationName,
      sku: cols[4]?.trim() || null,
      cost_price: cost,
      price,
      stock_quantity: Math.max(0, Math.trunc(parseNum(cols[7]))),
      min_order_quantity: Math.max(1, Math.trunc(parseNum(cols[8], 1))),
      reorder_point: parseOptionalInt(cols[9] ?? ''),
      reorder_qty: parseOptionalInt(cols[10] ?? ''),
    })
  }

  if (!rows.length) return { ok: false, error: 'No data rows found' }

  const groupMap = new Map<string, CsvImportProductGroup>()
  for (const row of rows) {
    const key = row.product_name.toLowerCase()
    let group = groupMap.get(key)
    if (!group) {
      group = {
        productName: row.product_name,
        marketplaceCategory: row.marketplace_category,
        isActive: row.is_active,
        variations: [],
      }
      groupMap.set(key, group)
    } else {
      if (row.marketplace_category && !group.marketplaceCategory) {
        group.marketplaceCategory = row.marketplace_category
      }
    }
    group.variations.push(row)
  }

  return { ok: true, groups: [...groupMap.values()], rowCount: rows.length }
}
