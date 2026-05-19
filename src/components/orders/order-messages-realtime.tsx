'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, Volume2, VolumeX } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { OrderMessageRow } from '@/lib/data/order-messages'
import { SendOrderMessageForm } from '@/components/orders/send-order-message-form'
import { formatTimeShort, normalizeAppLocale } from '@/lib/format-datetime'
import { playOrderChatIncomingSound, isOrderChatSoundMuted, setOrderChatSoundMuted } from '@/lib/order-chat-sound'
import { cn } from '@/lib/utils'

const BUCKET = 'order-attachments'
const SIGNED_TTL = 3600

type DbOrderMessage = {
  id: string
  order_id: string
  author_id: string
  body: string
  attachment_path: string | null
  attachment_name: string | null
  created_at: string
}

function authorInitials(label: string): string {
  const t = label.trim()
  if (!t) return '?'
  const parts = t.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2)
  return t.slice(0, 2).toUpperCase()
}

async function rowToViewModel(supabase: ReturnType<typeof supabaseBrowser>, row: DbOrderMessage): Promise<OrderMessageRow> {
  const { data: p } = await supabase
    .from('profiles')
    .select('business_name, name')
    .eq('user_id', row.author_id)
    .maybeSingle()

  const author_label = (p?.business_name || p?.name || 'User').trim() || 'User'

  let attachment_url: string | null = null
  if (row.attachment_path) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(row.attachment_path, SIGNED_TTL)
    attachment_url = signed?.signedUrl ?? null
  }

  return {
    id: row.id,
    author_id: row.author_id,
    body: String(row.body ?? ''),
    attachment_name: row.attachment_name,
    attachment_url,
    created_at: row.created_at,
    author_label,
  }
}

function sortMessages(rows: OrderMessageRow[]) {
  return [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
}

function mergeWithServer(prev: OrderMessageRow[], server: OrderMessageRow[]): OrderMessageRow[] {
  const map = new Map<string, OrderMessageRow>()
  for (const m of server) map.set(m.id, m)
  for (const m of prev) {
    if (!map.has(m.id)) map.set(m.id, m)
  }
  return sortMessages([...map.values()])
}

type Props = {
  orderId: string
  initialMessages: OrderMessageRow[]
}

export function OrderMessagesRealtime({ orderId, initialMessages }: Props) {
  const t = useTranslations('OrderMessages')
  const locale = useLocale()
  const [messages, setMessages] = useState<OrderMessageRow[]>(() => sortMessages(initialMessages))
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const currentUserIdRef = useRef<string | null>(null)
  const [soundMuted, setSoundMuted] = useState(false)

  const appLocale = normalizeAppLocale(locale)
  const fmtTime = useCallback((d: string) => formatTimeShort(d, appLocale), [appLocale])

  const serverMessageIds = useMemo(
    () =>
      [...initialMessages]
        .map((m) => m.id)
        .sort()
        .join('|'),
    [initialMessages],
  )

  const latestServerRows = useRef(initialMessages)
  latestServerRows.current = initialMessages

  useEffect(() => {
    setSoundMuted(isOrderChatSoundMuted())
  }, [])

  useEffect(() => {
    setMessages((prev) => mergeWithServer(prev, latestServerRows.current))
  }, [serverMessageIds])

  useEffect(() => {
    const supabase = supabaseBrowser()
    const syncUser = (id: string | null) => {
      currentUserIdRef.current = id
      setCurrentUserId(id)
    }
    void supabase.auth.getSession().then(({ data: { session } }) => {
      syncUser(session?.user?.id ?? null)
    })

    const channelName = `order-messages:${orderId}`
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null
    let starting = false

    const removeChannelSafe = (ch: ReturnType<typeof supabase.channel>) => {
      void supabase.removeChannel(ch)
    }

    const destroyChannel = () => {
      if (channel) {
        removeChannelSafe(channel)
        channel = null
      }
    }

    const ensureChannel = async () => {
      if (cancelled || starting) return
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return

      starting = true
      try {
        await supabase.realtime.setAuth(token)
        if (cancelled) return
        if (channel) return

        const ch = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'order_messages',
              filter: `order_id=eq.${orderId}`,
            },
            async (payload: { new: Record<string, unknown> }) => {
              const raw = payload.new
              if (!raw || typeof raw.id !== 'string') return
              if (String(raw.order_id) !== orderId) return
              const row: DbOrderMessage = {
                id: raw.id,
                order_id: String(raw.order_id),
                author_id: String(raw.author_id),
                body: typeof raw.body === 'string' ? raw.body : '',
                attachment_path: raw.attachment_path == null ? null : String(raw.attachment_path),
                attachment_name: raw.attachment_name == null ? null : String(raw.attachment_name),
                created_at: String(raw.created_at),
              }
              try {
                const vm = await rowToViewModel(supabase, row)
                const selfId = currentUserIdRef.current
                if (selfId && vm.author_id !== selfId) {
                  playOrderChatIncomingSound()
                }
                setMessages((prev) => {
                  if (prev.some((m) => m.id === vm.id)) return prev
                  return [...prev, vm].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                })
              } catch {
                // ignore enrichment failure; user can refresh
              }
            },
          )
          .subscribe((status, err) => {
            if (status === 'CHANNEL_ERROR' && err) {
              console.warn('order_messages realtime', err)
            }
          })

        if (cancelled) {
          removeChannelSafe(ch)
          return
        }
        channel = ch
      } finally {
        starting = false
      }
    }

    void ensureChannel()

    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      syncUser(session?.user?.id ?? null)
      const token = session?.access_token
      if (token) {
        await supabase.realtime.setAuth(token)
      }
      if (event === 'SIGNED_OUT') {
        destroyChannel()
        return
      }
      if (token && !channel && !cancelled) {
        void ensureChannel()
      }
    })

    return () => {
      cancelled = true
      authSub.unsubscribe()
      destroyChannel()
    }
  }, [orderId])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages])

  return (
    <section
      className={cn(
        'flex max-h-[min(32rem,72vh)] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-lg shadow-slate-200/50',
        'ring-1 ring-slate-900/[0.04]',
      )}
      aria-label={t('title')}
    >
      <header className="shrink-0 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white px-4 py-3 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight text-slate-900">{t('title')}</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-500/25">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                {t('live')}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">{t('lead')}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !soundMuted
              setOrderChatSoundMuted(next)
              setSoundMuted(next)
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            aria-pressed={soundMuted}
            aria-label={soundMuted ? t('unmuteSounds') : t('muteSounds')}
            title={soundMuted ? t('unmuteSounds') : t('muteSounds')}
          >
            {soundMuted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </header>

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-slate-100/70 px-3 py-4 sm:px-4"
        role="log"
        aria-relevant="additions"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200/80 text-slate-500">
              <MessageCircle className="h-7 w-7" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">{t('emptyTitle')}</p>
              <p className="mt-1 max-w-xs text-xs text-slate-500">{t('emptySubtitle')}</p>
            </div>
          </div>
        ) : (
          messages.map((m, i) => {
            const isMine = Boolean(currentUserId && m.author_id === currentUserId)
            const showMeta = i === 0 || messages[i - 1]?.author_id !== m.author_id
            return (
              <div
                key={m.id}
                className={cn('flex w-full gap-2', isMine ? 'flex-row-reverse' : 'flex-row')}
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                    isMine ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200/80',
                  )}
                  aria-hidden
                >
                  {authorInitials(m.author_label)}
                </div>
                <div className={cn('flex min-w-0 max-w-[min(88%,20rem)] flex-col gap-0.5', isMine ? 'items-end' : 'items-start')}>
                  {showMeta ? (
                    <span className={cn('px-1 text-[11px] font-medium text-slate-500', isMine && 'text-end')}>
                      {isMine ? t('you') : m.author_label}
                    </span>
                  ) : null}
                  <div
                    className={cn(
                      'rounded-2xl px-3.5 py-2.5 text-sm shadow-sm',
                      isMine ? 'bg-slate-900 text-white' : 'border border-slate-200/90 bg-white text-slate-800',
                    )}
                  >
                    {m.body ? <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p> : null}
                    {m.attachment_url && m.attachment_name ? (
                      <p className={cn('mt-2', m.body ? 'pt-2' : '', isMine ? 'border-t border-white/15' : 'border-t border-slate-100')}>
                        <Link
                          href={m.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            'text-sm font-medium underline-offset-2 hover:underline',
                            isMine ? 'text-teal-100 hover:text-white' : 'text-teal-700 hover:text-teal-900',
                          )}
                        >
                          {t('download')}: {m.attachment_name}
                        </Link>
                      </p>
                    ) : null}
                    <time
                      className={cn('mt-1 block text-[10px] tabular-nums opacity-70', isMine ? 'text-end' : 'text-start')}
                      dateTime={m.created_at}
                      suppressHydrationWarning
                    >
                      {fmtTime(m.created_at)}
                    </time>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <SendOrderMessageForm orderId={orderId} />
    </section>
  )
}
