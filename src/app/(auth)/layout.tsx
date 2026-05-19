import { headers } from 'next/headers'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'

const PASSWORD_FLOW_PATHS = ['/reset-password', '/email-verified']

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers()
  const pathname = hdrs.get('x-next-pathname') ?? hdrs.get('x-invoke-path') ?? ''
  const isPasswordFlow = PASSWORD_FLOW_PATHS.some((p) => pathname === p || pathname.endsWith(p))

  if (!isPasswordFlow) {
    const supabase = supabaseServer()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
      const role = (userRow?.role ?? 'retailer') as 'supplier' | 'retailer'
      redirect(role === 'supplier' ? '/supplier' : '/retailer')
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(13,148,136,0.18),transparent)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(15,118,110,0.08),transparent_50%)]" aria-hidden />
      <div className="absolute end-4 top-4 z-20 sm:end-6 sm:top-6">
        <LanguageSwitcher />
      </div>
      <div className="relative z-[1]">{children}</div>
    </div>
  )
}
