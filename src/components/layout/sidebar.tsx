'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  FileText,
  CircleDollarSign,
  BookOpen,
  BarChart3,
  TrendingUp,
  Scale,
  Store,
  Search,
  ShoppingBag,
  User,
  LogOut,
  Wallet,
  Warehouse,
  Truck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logout } from '@/lib/actions/auth'
import type { SupplierNavBadges } from '@/lib/supplier-nav-badges'
import { NavCountBadge } from '@/components/layout/nav-count-badge'
import { useSupplierNavBadges } from '@/components/layout/use-supplier-nav-badges'

type Role = 'supplier' | 'retailer'

type NavLabelKey =
  | 'dashboard'
  | 'products'
  | 'orders'
  | 'invoices'
  | 'payments'
  | 'depositProofs'
  | 'ledger'
  | 'finance'
  | 'reports'
  | 'reportsProfit'
  | 'inventoryInsights'
  | 'deliveryPersons'
  | 'tradeTerms'
  | 'profile'
  | 'browseSuppliers'
  | 'search'
  | 'cart'
  | 'myOrders'

type NavItem = {
  href: string
  labelKey: NavLabelKey
  icon: React.ComponentType<{ className?: string }>
  badgeKey?: 'pendingOrders' | 'pendingDeposits'
}

const supplierNav: NavItem[] = [
  { href: '/supplier', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/supplier/products', labelKey: 'products', icon: Package },
  { href: '/supplier/orders', labelKey: 'orders', icon: ShoppingCart, badgeKey: 'pendingOrders' },
  { href: '/supplier/delivery-persons', labelKey: 'deliveryPersons', icon: Truck },
  { href: '/supplier/invoices', labelKey: 'invoices', icon: FileText },
  { href: '/supplier/payments', labelKey: 'payments', icon: CircleDollarSign },
  {
    href: '/supplier/payments/deposits',
    labelKey: 'depositProofs',
    icon: CircleDollarSign,
    badgeKey: 'pendingDeposits',
  },
  { href: '/supplier/ledger', labelKey: 'ledger', icon: BookOpen },
  { href: '/supplier/finance', labelKey: 'finance', icon: Wallet },
  { href: '/supplier/reports', labelKey: 'reports', icon: BarChart3 },
  { href: '/supplier/reports/profit', labelKey: 'reportsProfit', icon: TrendingUp },
  { href: '/supplier/inventory-insights', labelKey: 'inventoryInsights', icon: Warehouse },
  { href: '/supplier/trade-terms', labelKey: 'tradeTerms', icon: Scale },
  { href: '/supplier/profile', labelKey: 'profile', icon: User },
]

const retailerNav: NavItem[] = [
  { href: '/retailer', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/retailer/search', labelKey: 'search', icon: Search },
  { href: '/retailer/browse', labelKey: 'browseSuppliers', icon: Store },
  { href: '/retailer/cart', labelKey: 'cart', icon: ShoppingBag },
  { href: '/retailer/orders', labelKey: 'myOrders', icon: ShoppingCart },
  { href: '/retailer/invoices', labelKey: 'invoices', icon: FileText },
  { href: '/retailer/payments', labelKey: 'payments', icon: CircleDollarSign },
  { href: '/retailer/ledger', labelKey: 'ledger', icon: BookOpen },
  { href: '/retailer/profile', labelKey: 'profile', icon: User },
]

type Props = {
  role: Role
  userName: string
  businessName: string
  supplierBadges?: SupplierNavBadges | null
  onNavigate?: () => void
  className?: string
}

export function Sidebar({ role, userName, businessName, supplierBadges, onNavigate, className }: Props) {
  const pathname = usePathname()
  const t = useTranslations('Nav')
  const items = role === 'supplier' ? supplierNav : retailerNav
  const liveBadges = useSupplierNavBadges(role === 'supplier' ? (supplierBadges ?? null) : null)

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="flex h-14 shrink-0 items-center px-4 sm:px-5">
        <Link
          href={role === 'supplier' ? '/supplier' : '/retailer'}
          className="text-lg font-semibold tracking-tight text-foreground"
          onClick={onNavigate}
        >
          {t('brand')}
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2 text-sm sm:px-3">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          const badgeCount =
            item.badgeKey && liveBadges
              ? item.badgeKey === 'pendingOrders'
                ? liveBadges.pendingOrders
                : liveBadges.pendingDeposits
              : 0
          const badgeLabel =
            item.badgeKey === 'pendingOrders'
              ? t('badgePendingOrders', { count: badgeCount })
              : item.badgeKey === 'pendingDeposits'
                ? t('badgePendingDeposits', { count: badgeCount })
                : ''
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                isActive && 'bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 leading-snug">{t(item.labelKey)}</span>
              {item.badgeKey ? (
                <NavCountBadge count={badgeCount} label={badgeLabel} active={isActive} />
              ) : null}
            </Link>
          )
        })}
      </nav>

      <div className="shrink-0 border-t border-border p-3 sm:p-4">
        <div className="mb-3 px-1">
          <p className="truncate text-sm font-medium text-foreground">{userName || t('account')}</p>
          <p className="truncate text-xs text-muted-foreground">{businessName || '—'}</p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            {t('signOut')}
          </button>
        </form>
      </div>
    </div>
  )
}
