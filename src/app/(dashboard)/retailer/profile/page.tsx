import { getTranslations } from 'next-intl/server'
import { requireRequestUserId } from '@/lib/auth/request-session'
import { supabaseServer } from '@/lib/supabase/server'
import { ProfileForm } from '@/components/profile/profile-form'

export default async function RetailerProfilePage() {
  const t = await getTranslations('ProfilePage')
  const userId = await requireRequestUserId()
  const supabase = supabaseServer()

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, business_name, phone, city, tax_id, commercial_registration, vat_registered, prefer_hijri')
    .eq('user_id', userId)
    .maybeSingle()

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{t('retailerTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">{t('retailerLead')}</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{t('retailerAccount')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('retailerAccountHint')}</p>
        <div className="mt-6">
          <ProfileForm
            defaultValues={{
              name: profile?.name ?? '',
              business_name: profile?.business_name ?? '',
              phone: profile?.phone ?? '',
              city: profile?.city ?? '',
              tax_id: (profile as { tax_id?: string | null } | null)?.tax_id ?? '',
              commercial_registration:
                (profile as { commercial_registration?: string | null } | null)?.commercial_registration ?? '',
              vat_registered: !!(profile as { vat_registered?: boolean } | null)?.vat_registered,
              prefer_hijri: !!(profile as { prefer_hijri?: boolean } | null)?.prefer_hijri,
            }}
          />
        </div>
      </section>
    </div>
  )
}
