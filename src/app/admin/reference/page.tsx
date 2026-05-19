import { getTranslations } from 'next-intl/server'
import { ENUM_CATALOG } from '@/lib/admin/enum-catalog'

export default async function AdminReferencePage() {
  const t = await getTranslations('Admin')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('referenceTitle')}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('referenceSubtitle')}</p>
      </div>

      <div className="space-y-4">
        {ENUM_CATALOG.map((row) => (
          <div key={row.name} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-mono text-sm font-semibold text-foreground">
                {row.schema}.{row.name}
              </h2>
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">
              {row.values.map((v) => (
                <li
                  key={String(v)}
                  className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground"
                >
                  {v}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">{row.note}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
