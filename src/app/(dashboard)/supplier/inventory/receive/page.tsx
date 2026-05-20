import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { PackagePlus } from 'lucide-react'
import { ReceiveStockWizard } from '@/components/supplier/receive-stock-wizard'
import { RetailerListPageHeader } from '@/components/retailer/retailer-list-page-header'
import { resolveSupplierAccess } from '@/lib/supplier/access'
import { redirect } from 'next/navigation'

export default async function SupplierReceiveStockPage() {
  const t = await getTranslations('ReceiveStock')
  const access = await resolveSupplierAccess()
  if (!access.access) redirect('/supplier')

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <RetailerListPageHeader icon={PackagePlus} title={t('title')} subtitle={t('subtitle')}>
        <Link
          href="/supplier/inventory-insights"
          className="inline-flex items-center rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted"
        >
          {t('viewInsights')}
        </Link>
      </RetailerListPageHeader>

      {!access.access.canAdjustInventory ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {t('readOnlyRole')}
        </div>
      ) : (
        <ReceiveStockWizard />
      )}
    </div>
  )
}
