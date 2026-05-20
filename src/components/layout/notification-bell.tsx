'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Bell } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { markAllNotificationsRead, markNotificationRead } from '@/lib/actions/notifications'
import { formatDateShort, normalizeAppLocale } from '@/lib/format-datetime'
import { cn } from '@/lib/utils'

type Role = 'supplier' | 'retailer'

type NotificationRow = {
  id: string
  type: string
  title: string
  message: string
  title_key?: string | null
  message_key?: string | null
  params?: Record<string, string | number> | null
  reference_id: string | null
  reference_type: string | null
  is_read: boolean
  created_at: string
}

/** Ensures JSON from Supabase serializes to values next-intl can interpolate ({stock}, etc.). */
function coerceParams(p: NotificationRow['params']): Record<string, string | number> | undefined {
  if (p == null) return undefined
  let raw: unknown = p
  if (typeof p === 'string') {
    try {
      raw = JSON.parse(p) as unknown
    } catch {
      return undefined
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v == null) continue
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    else if (typeof v === 'string') out[k] = v
    else if (typeof v === 'bigint') out[k] = Number(v)
    else if (typeof v === 'boolean') out[k] = v ? '1' : '0'
    else out[k] = String(v)
  }
  return Object.keys(out).length ? out : undefined
}

function normalizeNotificationKey(k: string): string {
  // `t` is already scoped to the "Notifications" namespace.
  let key = k
  if (key.startsWith('Notifications.')) key = key.slice('Notifications.'.length)
  if (key.startsWith('notifications.')) key = key.slice('notifications.'.length)

  const legacy: Record<string, string> = {
    'low_stock.title': 'lowStock.title',
    'low_stock.message': 'lowStock.message',
  }
  return legacy[key] ?? key
}

function normalizeNotificationParams(
  type: string,
  params: Record<string, string | number> | undefined,
): Record<string, string | number> | undefined {
  if (!params || type !== 'low_stock') return params

  const out = { ...params }
  if (out.product == null && out.productName != null) out.product = String(out.productName)
  if (out.variation == null && out.variationName != null) out.variation = String(out.variationName)
  if (out.stock == null && out.quantity != null) out.stock = Number(out.quantity)
  return out
}

function resolveHref(role: Role, n: NotificationRow): string | null {
  if (n.type === 'low_stock' && n.reference_id && n.reference_type === 'product') {
    return `/supplier/products/${n.reference_id}?tab=stock`
  }
  if (n.type === 'low_stock') return '/supplier/products?lowStock=1'
  if (!n.reference_id) return null
  const id = n.reference_id
  switch (n.reference_type) {
    case 'variation':
      return role === 'supplier' ? '/supplier/products' : null
    case 'order':
      return role === 'supplier' ? `/supplier/orders/${id}` : `/retailer/orders/${id}`
    case 'invoice':
      return role === 'supplier' ? `/supplier/invoices/${id}` : `/retailer/invoices/${id}`
    case 'payment':
      return role === 'supplier' ? '/supplier/invoices' : '/retailer/invoices'
    case 'deposit_proof':
      return role === 'supplier' ? '/supplier/payments/deposits' : null
    default:
      if (n.type === 'payment_recorded') {
        return role === 'supplier' ? '/supplier/invoices' : '/retailer/invoices'
      }
      return null
  }
}

type Props = {
  role: Role
}

export function NotificationBell({ role }: Props) {
  const t = useTranslations('Notifications')
  const locale = normalizeAppLocale(useLocale())
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const unreadCount = rows.filter((r) => !r.is_read).length

  const load = useCallback(async () => {
    const supabase = supabaseBrowser()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setRows([])
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, message, title_key, message_key, params, reference_id, reference_type, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(40)

    if (error) {
      setRows([])
    } else {
      setRows((data ?? []) as NotificationRow[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const supabase = supabaseBrowser()
    let cancelled = false
    const channelRef = { current: null as ReturnType<typeof supabase.channel> | null }

    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      channelRef.current = supabase
        .channel(`notifications:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            load()
          },
        )
        .subscribe()
    })()

    return () => {
      cancelled = true
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [load])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return
      const target = e.target as Node
      if (panelRef.current?.contains(target) || btnRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [open])

  /** Mark every unread notification read when the panel is opened. */
  useEffect(() => {
    if (!open || loading) return
    if (!rows.some((r) => !r.is_read)) return

    let cancelled = false
    setRows((prev) => prev.map((x) => ({ ...x, is_read: true })))

    ;(async () => {
      const r = await markAllNotificationsRead()
      if (cancelled) return
      if (r.error) void load()
    })()

    return () => {
      cancelled = true
    }
  }, [open, loading, rows, load])

  async function onItemClick(n: NotificationRow) {
    const href = resolveHref(role, n)
    if (!n.is_read) {
      const r = await markNotificationRead(n.id)
      if (!r.error) {
        setRows((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
      }
    }
    setOpen(false)
    if (href) router.push(href)
    else router.refresh()
  }

  async function onMarkAll() {
    const r = await markAllNotificationsRead()
    if (!r.error) {
      setRows((prev) => prev.map((x) => ({ ...x, is_read: true })))
    }
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground transition hover:bg-muted"
        aria-label={t('ariaLabel')}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -end-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-4 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute end-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-border bg-card shadow-xl shadow-slate-900/10"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('title')}</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => onMarkAll()}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {t('markAll')}
              </button>
            )}
          </div>
          <div className="max-h-[min(70vh,24rem)] overflow-y-auto">
            {loading ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('loading')}</p>
            ) : rows.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('empty')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((n) => {
                  const href = resolveHref(role, n)
                  const params = normalizeNotificationParams(n.type, coerceParams(n.params))
                  const titleKey =
                    n.title_key ??
                    (n.type === 'low_stock' && params ? 'lowStock.title' : null)
                  const messageKey =
                    n.message_key ??
                    (n.type === 'low_stock' && params ? 'lowStock.message' : null)
                  const title = titleKey
                    ? t(normalizeNotificationKey(String(titleKey)), params)
                    : n.title
                  const message = messageKey
                    ? t(normalizeNotificationKey(String(messageKey)), params)
                    : n.message
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => onItemClick(n)}
                        className={cn(
                          'w-full px-3 py-2.5 text-start text-sm transition hover:bg-muted/60',
                          !n.is_read && 'bg-primary/5',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-foreground">{title}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatDateShort(n.created_at, locale)}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{message}</p>
                        {href && (
                          <span className="mt-1 inline-block text-xs text-primary underline-offset-2 hover:underline">
                            {t('open')}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="border-t border-border px-3 py-2 text-center">
            <Link
              href={role === 'supplier' ? '/supplier' : '/retailer'}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              {t('dashboard')}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
