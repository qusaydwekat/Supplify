import { getTranslations } from 'next-intl/server'
import { requireRequestUserId } from '@/lib/auth/request-session'
import { supabaseServer } from '@/lib/supabase/server'
import { ProfileForm } from '@/components/profile/profile-form'
import { SupplierProfileForm } from '@/components/profile/supplier-profile-form'
import type { MarketplaceCategorySlug } from '@/lib/supplier-marketplace-categories'
import {
  SupplierBankAccounts,
  type SupplierBankAccountRow,
} from '@/components/profile/supplier-bank-accounts'

export default async function SupplierProfilePage() {
  const t = await getTranslations('ProfilePage')
  const userId = await requireRequestUserId()
  const supabase = supabaseServer()

  const [{ data: profile }, { data: supplier }, { data: bankAccounts }] = await Promise.all([
    supabase
      .from('profiles')
      .select('name, business_name, phone, city, tax_id, commercial_registration, vat_registered, prefer_hijri')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('suppliers')
      .select('id, description, delivery_areas, logo_url, is_active, currency_code, marketplace_categories')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('supplier_bank_accounts')
      .select(
        'id, bank_name, branch, account_holder, iban, account_number, swift, is_default, is_active, notes',
      )
      .order('is_default', { ascending: false })
      .order('bank_name'),
  ])

  const bankAccountRows: SupplierBankAccountRow[] = ((bankAccounts ?? []) as SupplierBankAccountRow[]).filter(
    () => true,
  )

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{t('supplierTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">{t('supplierLead')}</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{t('accountSection')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('accountHint')}</p>
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

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{t('bankAccountsSection')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('bankAccountsHint')}</p>
        <div className="mt-6">
          <SupplierBankAccounts accounts={bankAccountRows} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{t('storefrontSection')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('storefrontHint')}</p>
        <div className="mt-6">
          <SupplierProfileForm
            defaultValues={{
              description: supplier?.description ?? '',
              delivery_areas: supplier?.delivery_areas ?? [],
              logo_url: supplier?.logo_url ?? '',
              is_active: supplier?.is_active ?? true,
              currency_code: String((supplier as { currency_code?: string } | null)?.currency_code ?? 'USD'),
              marketplace_categories: (supplier?.marketplace_categories ?? []) as MarketplaceCategorySlug[],
            }}
          />
        </div>
      </section>
    </div>
  )
}
