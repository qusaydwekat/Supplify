'use client'

import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { NavCountBadge } from '@/components/layout/nav-count-badge'
import type { NavGroup, NavItem } from '@/components/layout/sidebar-nav-config'
import { resolveActiveHref } from '@/components/layout/sidebar-nav-config'
import type { SupplierNavBadges } from '@/lib/supplier-nav-badges'
import { cn } from '@/lib/utils'

type Props = {
  group: NavGroup
  pathname: string
  open: boolean
  onToggle: () => void
  liveBadges: SupplierNavBadges | null
  onNavigate?: () => void
}

function itemBadgeCount(item: NavItem, liveBadges: SupplierNavBadges | null): number {
  if (!item.badgeKey || !liveBadges) return 0
  return item.badgeKey === 'pendingOrders' ? liveBadges.pendingOrders : liveBadges.pendingDeposits
}

export function SidebarNavGroup({ group, pathname, open, onToggle, liveBadges, onNavigate }: Props) {
  const t = useTranslations('Nav')
  const Icon = group.icon
  const hrefs = group.items.map((i) => i.href)
  const activeHref = resolveActiveHref(pathname, hrefs)
  const groupActive = activeHref !== null

  const groupBadgeTotal = group.items.reduce((sum, item) => sum + itemBadgeCount(item, liveBadges), 0)

  return (
    <div className="rounded-xl border border-transparent transition-colors has-[[data-open=true]]:border-border/60 has-[[data-open=true]]:bg-muted/30">
      <button
        type="button"
        data-open={open}
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-start text-sm font-semibold transition-colors',
          groupActive ? 'text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          open && 'pb-1',
        )}
      >
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
            groupActive ? 'bg-primary/10 text-primary' : 'bg-muted/80 text-muted-foreground',
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 leading-snug">{t(group.labelKey)}</span>
        {groupBadgeTotal > 0 ? (
          <NavCountBadge
            count={groupBadgeTotal}
            label={t('badgeGroupAlerts', { count: groupBadgeTotal })}
            active={false}
          />
        ) : null}
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <ul className="space-y-0.5 px-1.5 pb-2 pt-0.5">
            {group.items.map((item) => {
              const isActive = activeHref === item.href
              const ItemIcon = item.icon
              const badgeCount = itemBadgeCount(item, liveBadges)
              const badgeLabel =
                item.badgeKey === 'pendingOrders'
                  ? t('badgePendingOrders', { count: badgeCount })
                  : item.badgeKey === 'pendingDeposits'
                    ? t('badgePendingDeposits', { count: badgeCount })
                    : ''

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'group/item relative flex items-center gap-2.5 rounded-lg py-2 pe-2.5 ps-9 text-[13px] font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute start-3.5 top-1/2 h-5 w-px -translate-y-1/2 rounded-full transition-colors',
                        isActive ? 'bg-primary-foreground/40' : 'bg-border group-hover/item:bg-muted-foreground/30',
                      )}
                      aria-hidden
                    />
                    <ItemIcon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                    <span className="min-w-0 flex-1 leading-snug">{t(item.labelKey)}</span>
                    {item.badgeKey ? (
                      <NavCountBadge count={badgeCount} label={badgeLabel} active={isActive} />
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
