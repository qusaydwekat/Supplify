import { getTranslations } from 'next-intl/server'
import { getAdminCurrencyState } from '@/lib/data/admin/currencies'
import { AdminCurrenciesPanel } from '@/components/admin/admin-currencies-panel'

export default async function AdminCurrenciesPage() {
  const t = await getTranslations('Admin')
  const state = await getAdminCurrencyState()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('currenciesTitle')}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('currenciesSubtitle')}</p>
      </div>
      <AdminCurrenciesPanel
        defaultCurrency={state.defaultCurrency}
        rates={state.rates}
        fxLastFetchedAt={state.fxLastFetchedAt}
        fxLastSource={state.fxLastSource}
      />
    </div>
  )
}
