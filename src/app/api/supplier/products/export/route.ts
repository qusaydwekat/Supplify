import { NextResponse } from 'next/server'
import { fetchProductsForExport, productsExportToCsv } from '@/lib/data/products/export-products'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const search = url.searchParams.get('q') ?? undefined
  const marketplaceCategory = url.searchParams.get('category') ?? undefined
  const status = (url.searchParams.get('status') ?? 'all') as 'all' | 'active' | 'inactive'
  const lowStockOnly = url.searchParams.get('lowStock') === '1'

  const { rows, error } = await fetchProductsForExport({
    search,
    marketplaceCategory,
    status,
    lowStockOnly,
  })

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  const csv = productsExportToCsv(rows)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="products-export.csv"',
    },
  })
}
