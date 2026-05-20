'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ProductsImportButton } from '@/components/products/products-import-button'
import { bulkSetProductsActive, bulkSetProductsCategory } from '@/lib/actions/products-bulk'
import { formatDateDayMonthYear, normalizeAppLocale } from '@/lib/format-datetime'
import { MARKETPLACE_CATEGORY_SLUGS } from '@/lib/supplier-marketplace-categories'
import type { ProductCatalogStatus, ProductListRow } from '@/lib/types/products'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type Props = {
  rows: ProductListRow[]
  exportHref: string
}

export function ProductsListTable({ rows, exportHref }: Props) {
  const t = useTranslations('ProductsPage')
  const tCatalog = useTranslations('ProductCatalog')
  const tCommon = useTranslations('Common')
  const tCat = useTranslations('MarketplaceCategories')
  const locale = normalizeAppLocale(useLocale())
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] = useState('')
  const [pending, setPending] = useState(false)

  const allSelected = rows.length > 0 && selected.size === rows.length
  const ids = useMemo(() => [...selected], [selected])

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(rows.map((r) => r.id)))
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function runBulk(fn: () => Promise<{ error: string | null; count?: number }>) {
    if (!ids.length) return
    setPending(true)
    const res = await fn()
    setPending(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('bulkSuccess', { count: res.count ?? ids.length }))
    setSelected(new Set())
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/supplier/products?lowStock=1"
            className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-900 hover:bg-amber-100"
          >
            {t('viewLowStock')}
          </Link>
          <Link
            href="/supplier/products?status=inactive"
            className="rounded-full border border-border bg-card px-3 py-1 text-foreground hover:bg-muted"
          >
            {t('viewInactive')}
          </Link>
          <Link
            href="/supplier/products?catalog=draft"
            className="rounded-full border border-border bg-card px-3 py-1 text-foreground hover:bg-muted"
          >
            {t('viewDrafts')}
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <ProductsImportButton exportHref={exportHref} />
          <a
            href={exportHref}
            className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
          >
            {t('exportCsv')}
          </a>
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <span className="text-sm font-medium text-foreground">{t('bulkSelected', { count: selected.size })}</span>
          <Button
            type="button"
            className="h-8 min-h-8 px-3 text-xs"
            variant="secondary"
            disabled={pending}
            onClick={() => void runBulk(() => bulkSetProductsActive(ids, true))}
          >
            {t('bulkActivate')}
          </Button>
          <Button
            type="button"
            className="h-8 min-h-8 px-3 text-xs"
            variant="secondary"
            disabled={pending}
            onClick={() => void runBulk(() => bulkSetProductsActive(ids, false))}
          >
            {t('bulkDeactivate')}
          </Button>
          <select
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value)}
            className="h-8 rounded-md border border-border bg-card px-2 text-sm"
          >
            <option value="">{t('bulkCategoryPick')}</option>
            {MARKETPLACE_CATEGORY_SLUGS.map((slug) => (
              <option key={slug} value={slug}>
                {tCat(slug)}
              </option>
            ))}
          </select>
          <Button
            type="button"
            className="h-8 min-h-8 px-3 text-xs"
            disabled={pending || !bulkCategory}
            onClick={() => void runBulk(() => bulkSetProductsCategory(ids, bulkCategory))}
          >
            {t('bulkApplyCategory')}
          </Button>
          <Button type="button" className="h-8 min-h-8 px-3 text-xs" variant="ghost" onClick={() => setSelected(new Set())}>
            {tCommon('cancel')}
          </Button>
        </div>
      ) : null}

      <div className="app-surface">
        <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="min-w-[720px] w-full divide-y divide-border text-sm">
            <thead className="bg-muted/80">
              <tr>
                <th className="w-10 px-3 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label={t('selectAll')} />
                </th>
                <th className="px-4 py-3 text-start font-semibold text-foreground">{t('name')}</th>
                <th className="px-4 py-3 text-start font-semibold text-foreground">{t('category')}</th>
                <th className="px-4 py-3 text-center font-semibold text-foreground">{t('variations')}</th>
                <th className="px-4 py-3 text-center font-semibold text-foreground">{t('catalogCol')}</th>
                <th className="px-4 py-3 text-center font-semibold text-foreground">{t('status')}</th>
                <th className="px-4 py-3 text-start font-semibold text-foreground">{t('updated')}</th>
                <th className="px-4 py-3 text-end font-semibold text-foreground">{tCommon('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/80">
              {rows.map((row) => {
                const varCount = row.hasVariations ? row.variationCount : 1
                return (
                  <tr
                    key={row.id}
                    className={cn('transition-colors hover:bg-muted/40', row.hasLowStock && 'bg-amber-50/90')}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggle(row.id)}
                        aria-label={row.name}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {row.name}
                      {row.hasLowStock ? (
                        <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                          {t('lowStock')}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.marketplaceCategory ? tCat(row.marketplaceCategory) : row.category ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{varCount}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          row.catalogStatus === 'published' && 'bg-emerald-100 text-emerald-800',
                          row.catalogStatus === 'draft' && 'bg-slate-200 text-slate-800',
                          row.catalogStatus === 'archived' && 'bg-amber-100 text-amber-900',
                        )}
                      >
                        {tCatalog(`status_${row.catalogStatus as ProductCatalogStatus}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          row.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700',
                        )}
                      >
                        {row.isActive ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateDayMonthYear(row.updatedAt, locale)}</td>
                    <td className="px-4 py-3 text-end">
                      <Link
                        href={`/supplier/products/${row.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {tCommon('edit')}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
        )}
      </div>
    </div>
  )
}
