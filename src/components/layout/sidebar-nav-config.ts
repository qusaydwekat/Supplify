import type { LucideIcon } from 'lucide-react'
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
  Users,
  Wallet,
  Warehouse,
  Truck,
  PackagePlus,
  Receipt,
  LineChart,
  Settings2,
} from 'lucide-react'

export type NavLabelKey =
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
  | 'receiveStock'
  | 'productPerformance'
  | 'team'
  | 'deliveryPersons'
  | 'tradeTerms'
  | 'profile'
  | 'browseSuppliers'
  | 'search'
  | 'cart'
  | 'myOrders'

export type NavGroupLabelKey =
  | 'groupSales'
  | 'groupCatalog'
  | 'groupFinance'
  | 'groupInsights'
  | 'groupBusiness'
  | 'groupDiscover'
  | 'groupAccount'

export type NavItem = {
  href: string
  labelKey: NavLabelKey
  icon: LucideIcon
  badgeKey?: 'pendingOrders' | 'pendingDeposits'
}

export type NavGroup = {
  id: string
  labelKey: NavGroupLabelKey
  icon: LucideIcon
  items: NavItem[]
}

export type NavEntry = NavItem | NavGroup

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'items' in entry
}

export const supplierNav: NavEntry[] = [
  { href: '/supplier', labelKey: 'dashboard', icon: LayoutDashboard },
  {
    id: 'sales',
    labelKey: 'groupSales',
    icon: ShoppingCart,
    items: [
      { href: '/supplier/orders', labelKey: 'orders', icon: ShoppingCart, badgeKey: 'pendingOrders' },
      { href: '/supplier/delivery-persons', labelKey: 'deliveryPersons', icon: Truck },
    ],
  },
  {
    id: 'catalog',
    labelKey: 'groupCatalog',
    icon: Package,
    items: [
      { href: '/supplier/products', labelKey: 'products', icon: Package },
      { href: '/supplier/inventory-insights', labelKey: 'inventoryInsights', icon: Warehouse },
      { href: '/supplier/inventory/receive', labelKey: 'receiveStock', icon: PackagePlus },
      { href: '/supplier/products/performance', labelKey: 'productPerformance', icon: TrendingUp },
    ],
  },
  {
    id: 'finance',
    labelKey: 'groupFinance',
    icon: Wallet,
    items: [
      { href: '/supplier/invoices', labelKey: 'invoices', icon: FileText },
      { href: '/supplier/payments', labelKey: 'payments', icon: CircleDollarSign },
      {
        href: '/supplier/payments/deposits',
        labelKey: 'depositProofs',
        icon: Receipt,
        badgeKey: 'pendingDeposits',
      },
      { href: '/supplier/ledger', labelKey: 'ledger', icon: BookOpen },
      { href: '/supplier/finance', labelKey: 'finance', icon: Wallet },
    ],
  },
  {
    id: 'insights',
    labelKey: 'groupInsights',
    icon: BarChart3,
    items: [
      { href: '/supplier/reports', labelKey: 'reports', icon: BarChart3 },
      { href: '/supplier/reports/profit', labelKey: 'reportsProfit', icon: LineChart },
    ],
  },
  {
    id: 'business',
    labelKey: 'groupBusiness',
    icon: Settings2,
    items: [
      { href: '/supplier/team', labelKey: 'team', icon: Users },
      { href: '/supplier/trade-terms', labelKey: 'tradeTerms', icon: Scale },
      { href: '/supplier/profile', labelKey: 'profile', icon: User },
    ],
  },
]

export const retailerNav: NavEntry[] = [
  { href: '/retailer', labelKey: 'dashboard', icon: LayoutDashboard },
  {
    id: 'discover',
    labelKey: 'groupDiscover',
    icon: Store,
    items: [
      { href: '/retailer/search', labelKey: 'search', icon: Search },
      { href: '/retailer/browse', labelKey: 'browseSuppliers', icon: Store },
      { href: '/retailer/cart', labelKey: 'cart', icon: ShoppingBag },
    ],
  },
  {
    id: 'account',
    labelKey: 'groupAccount',
    icon: FileText,
    items: [
      { href: '/retailer/orders', labelKey: 'myOrders', icon: ShoppingCart },
      { href: '/retailer/invoices', labelKey: 'invoices', icon: FileText },
      { href: '/retailer/payments', labelKey: 'payments', icon: CircleDollarSign },
      { href: '/retailer/ledger', labelKey: 'ledger', icon: BookOpen },
    ],
  },
  { href: '/retailer/profile', labelKey: 'profile', icon: User },
]

export function collectNavHrefs(entries: NavEntry[]): string[] {
  const hrefs: string[] = []
  for (const entry of entries) {
    if (isNavGroup(entry)) hrefs.push(...entry.items.map((i) => i.href))
    else hrefs.push(entry.href)
  }
  return hrefs
}

/** Most-specific href wins (e.g. /products/performance over /products). */
export function resolveActiveHref(pathname: string, hrefs: string[]): string | null {
  const sorted = [...hrefs].sort((a, b) => b.length - a.length)
  for (const href of sorted) {
    if (pathname === href || pathname.startsWith(`${href}/`)) return href
  }
  return null
}

export function groupContainsActive(pathname: string, group: NavGroup): boolean {
  const hrefs = group.items.map((i) => i.href)
  return resolveActiveHref(pathname, hrefs) !== null
}
