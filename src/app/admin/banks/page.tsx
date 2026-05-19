import { getTranslations } from 'next-intl/server'
import { BanksDirectory } from '@/components/banks/banks-directory'
import { listPalestineBanksAndBranches } from '@/lib/data/palestine-banks'

export default async function AdminBanksPage() {
  const t = await getTranslations('BanksDirectoryPage')
  const data = await listPalestineBanksAndBranches()

  if ('error' in data) {
    return <p className="text-sm text-red-600">{t('loadError', { details: data.error })}</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        <p className="mt-2 text-xs text-muted-foreground">{t('pmaHint')}</p>
      </div>
      <BanksDirectory banks={data.banks} branches={data.branches} />
    </div>
  )
}
