'use client'

import { useTranslations } from 'next-intl'
import { MARKETPLACE_CATEGORY_SLUGS, type MarketplaceCategorySlug } from '@/lib/supplier-marketplace-categories'

type Props = {
  name?: string
  defaultValue?: MarketplaceCategorySlug | '' | null
  className?: string
}

export function MarketplaceCategorySelect({ name = 'marketplace_category', defaultValue, className }: Props) {
  const t = useTranslations('MarketplaceCategories')
  const tForm = useTranslations('ProductForm')

  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ''}
      className={
        className ??
        'mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'
      }
    >
      <option value="">{tForm('categoryNone')}</option>
      {MARKETPLACE_CATEGORY_SLUGS.map((slug) => (
        <option key={slug} value={slug}>
          {t(slug)}
        </option>
      ))}
    </select>
  )
}
