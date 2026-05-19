import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/utils'
import { paginationWindowPages } from '@/lib/pagination-window'

type Props = {
  page: number
  totalPages: number
  totalCount: number
  pageSize: number
  buildHref: (nextPage: number) => string
  /** Larger window on wide screens handled via smaller neighbor counts on mobile (fixed 1 neighbor is fine UX). */
  pageNeighborWindow?: number
}

const linkCls =
  'inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card px-2.5 py-2 text-center text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35'

export async function ListPagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  buildHref,
  pageNeighborWindow = 1,
}: Props) {
  const t = await getTranslations('Common')
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalCount)
  const items = paginationWindowPages(page, totalPages, pageNeighborWindow)

  return (
    <nav
      className="flex flex-col gap-3 border-t border-border px-4 py-4 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
      aria-label={t('paginationNavLabel')}
    >
      <p className="tabular-nums">
        {totalCount === 0 ? (
          t('noResults')
        ) : (
          t('showing', { start, end, total: totalCount, page, pages: totalPages })
        )}
      </p>

      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
        {totalPages <= 1 || totalCount === 0 ? null : (
          <>
            {page > 1 ? (
              <Link href={buildHref(1)} className={cn(linkCls, 'gap-1 px-3')} aria-label={t('firstPage')}>
                <span aria-hidden>{'«'}</span>
                <span className="hidden sm:inline">{t('firstPage')}</span>
              </Link>
            ) : (
              <span
                className={cn(linkCls, 'cursor-not-allowed opacity-40')}
                aria-disabled
                aria-label={t('firstPage')}
              >
                «
              </span>
            )}
            {page > 1 ? (
              <Link href={buildHref(page - 1)} className={cn(linkCls, 'px-3')} aria-label={t('previous')}>
                ‹ {t('previous')}
              </Link>
            ) : (
              <span className={cn(linkCls, 'cursor-not-allowed opacity-40')} aria-disabled>
                ‹ {t('previous')}
              </span>
            )}

            <ul className="flex flex-wrap items-center gap-1" role="list">
              {items.map((item, i) =>
                item === 'ellipsis' ? (
                  // eslint-disable-next-line react/no-array-index-key -- static decorative keys
                  <li key={`e-${i}`} className="px-2" aria-hidden>
                    <span className="tabular-nums">…</span>
                  </li>
                ) : (
                  <li key={item}>
                    {item === page ? (
                      <span
                        className={cn(
                          linkCls,
                          'border-primary bg-primary/10 font-semibold text-primary',
                          'pointer-events-none',
                        )}
                        aria-current="page"
                        aria-label={t('paginationPageAria', { page: item })}
                      >
                        {item}
                      </span>
                    ) : (
                      <Link
                        href={buildHref(item)}
                        className={linkCls}
                        aria-label={t('paginationPageAria', { page: item })}
                      >
                        {item}
                      </Link>
                    )}
                  </li>
                ),
              )}
            </ul>

            {page < totalPages ? (
              <Link href={buildHref(page + 1)} className={cn(linkCls, 'px-3')} aria-label={t('next')}>
                {t('next')} ›
              </Link>
            ) : (
              <span className={cn(linkCls, 'cursor-not-allowed opacity-40')} aria-disabled>
                {t('next')} ›
              </span>
            )}
            {page < totalPages ? (
              <Link
                href={buildHref(totalPages)}
                className={cn(linkCls, 'gap-1 px-3')}
                aria-label={t('lastPage')}
              >
                <span className="hidden sm:inline">{t('lastPage')}</span>
                <span aria-hidden>»</span>
              </Link>
            ) : (
              <span className={cn(linkCls, 'cursor-not-allowed opacity-40')} aria-disabled aria-label={t('lastPage')}>
                »
              </span>
            )}
          </>
        )}
      </div>
    </nav>
  )
}
