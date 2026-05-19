'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard,
  Users,
  Store,
  ShoppingBag,
  Building2,
  CircleDollarSign,
  BookMarked,
  ScrollText,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logout } from '@/lib/actions/auth'

type AdminNavKey =
  | 'adminDashboard'
  | 'adminUsers'
  | 'adminSuppliers'
  | 'adminRetailers'
  | 'adminBanks'
  | 'adminCurrencies'
  | 'adminReference'
  | 'adminAudit'

type NavItem = { href: string; labelKey: AdminNavKey; icon: React.ComponentType<{ className?: string }> }

const adminNav: NavItem[] = [
  { href: '/admin', labelKey: 'adminDashboard', icon: LayoutDashboard },
  { href: '/admin/users', labelKey: 'adminUsers', icon: Users },
  { href: '/admin/suppliers', labelKey: 'adminSuppliers', icon: Store },
  { href: '/admin/retailers', labelKey: 'adminRetailers', icon: ShoppingBag },
  { href: '/admin/banks', labelKey: 'adminBanks', icon: Building2 },
  { href: '/admin/currencies', labelKey: 'adminCurrencies', icon: CircleDollarSign },
  { href: '/admin/reference', labelKey: 'adminReference', icon: BookMarked },
  { href: '/admin/audit', labelKey: 'adminAudit', icon: ScrollText },
]

type Props = {
  userName: string
  email: string | null
  onNavigate?: () => void
  className?: string
}

export function AdminSidebar({ userName, email, onNavigate, className }: Props) {
  const pathname = usePathname()
  const t = useTranslations('Nav')

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="flex h-14 shrink-0 items-center px-4 sm:px-5">
        <Link
          href="/admin"
          className="text-lg font-semibold tracking-tight text-white"
          onClick={onNavigate}
        >
          {t('adminPanel')}
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2 text-sm sm:px-3">
        {adminNav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white',
                isActive && 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary hover:text-primary-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="leading-snug">{t(item.labelKey)}</span>
            </Link>
          )
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3 sm:p-4">
        <div className="mb-3 px-1">
          <p className="truncate text-sm font-medium text-white">{userName || email || '—'}</p>
          {email ? <p className="truncate text-xs text-slate-400">{email}</p> : null}
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            {t('signOut')}
          </button>
        </form>
      </div>
    </div>
  )
}
