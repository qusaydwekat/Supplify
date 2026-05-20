'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LogOut } from 'lucide-react'
import { SidebarNavGroup } from '@/components/layout/sidebar-nav-group'
import {
  collectNavHrefs,
  isNavGroup,
  resolveActiveHref,
  retailerNav,
  supplierNav,
  type NavEntry,
  type NavItem,
} from '@/components/layout/sidebar-nav-config'
import { NavCountBadge } from '@/components/layout/nav-count-badge'
import { useSupplierNavBadges } from '@/components/layout/use-supplier-nav-badges'
import { logout } from '@/lib/actions/auth'
import type { SupplierNavBadges } from '@/lib/supplier-nav-badges'
import { cn } from '@/lib/utils'

type Role = 'supplier' | 'retailer'

type Props = {
  role: Role
  userName: string
  businessName: string
  supplierBadges?: SupplierNavBadges | null
  onNavigate?: () => void
  className?: string
}

function itemBadgeCount(item: NavItem, liveBadges: SupplierNavBadges | null): number {
  if (!item.badgeKey || !liveBadges) return 0
  return item.badgeKey === 'pendingOrders' ? liveBadges.pendingOrders : liveBadges.pendingDeposits
}

function openGroupsForPath(entries: NavEntry[], pathname: string): Record<string, boolean> {
  const next: Record<string, boolean> = {}
  for (const entry of entries) {
    if (isNavGroup(entry)) {
      next[entry.id] = resolveActiveHref(pathname, entry.items.map((i) => i.href)) !== null
    }
  }
  return next
}

export function Sidebar({ role, userName, businessName, supplierBadges, onNavigate, className }: Props) {
  const pathname = usePathname()
  const t = useTranslations('Nav')
  const entries = role === 'supplier' ? supplierNav : retailerNav
  const liveBadges = useSupplierNavBadges(role === 'supplier' ? (supplierBadges ?? null) : null)
  const allHrefs = useMemo(() => collectNavHrefs(entries), [entries])
  const activeHref = resolveActiveHref(pathname, allHrefs)

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => openGroupsForPath(entries, pathname))

  useEffect(() => {
    setOpenGroups((prev) => {
      const auto = openGroupsForPath(entries, pathname)
      const merged = { ...prev }
      for (const [id, shouldOpen] of Object.entries(auto)) {
        if (shouldOpen) merged[id] = true
      }
      return merged
    })
  }, [pathname, entries])

  const toggleGroup = useCallback((id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="flex h-14 shrink-0 items-center border-b border-border/60 px-4 sm:px-5">
        <Link
          href={role === 'supplier' ? '/supplier' : '/retailer'}
          className="text-lg font-bold tracking-tight text-foreground"
          onClick={onNavigate}
        >
          {t('brand')}
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3 sm:px-3" aria-label={t('sidebarLabel')}>
        {entries.map((entry) => {
          if (isNavGroup(entry)) {
            return (
              <SidebarNavGroup
                key={entry.id}
                group={entry}
                pathname={pathname}
                open={openGroups[entry.id] ?? false}
                onToggle={() => toggleGroup(entry.id)}
                liveBadges={liveBadges}
                onNavigate={onNavigate}
              />
            )
          }

          const isActive = activeHref === entry.href
          const Icon = entry.icon
          const badgeCount = itemBadgeCount(entry, liveBadges)
          const badgeLabel =
            entry.badgeKey === 'pendingOrders'
              ? t('badgePendingOrders', { count: badgeCount })
              : entry.badgeKey === 'pendingDeposits'
                ? t('badgePendingDeposits', { count: badgeCount })
                : ''

          return (
            <Link
              key={entry.href}
              href={entry.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm font-semibold transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  isActive ? 'bg-primary-foreground/15' : 'bg-muted/80',
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 leading-snug">{t(entry.labelKey)}</span>
              {entry.badgeKey ? (
                <NavCountBadge count={badgeCount} label={badgeLabel} active={isActive} />
              ) : null}
            </Link>
          )
        })}
      </nav>

      <div className="shrink-0 border-t border-border bg-muted/20 p-3 sm:p-4">
        <div className="mb-3 rounded-xl bg-card px-3 py-2.5 shadow-sm ring-1 ring-border/60">
          <p className="truncate text-sm font-semibold text-foreground">{userName || t('account')}</p>
          <p className="truncate text-xs text-muted-foreground">{businessName || '—'}</p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            {t('signOut')}
          </button>
        </form>
      </div>
    </div>
  )
}
