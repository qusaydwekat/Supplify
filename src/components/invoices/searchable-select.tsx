'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export type SearchableOption = { value: string; label: string; sublabel?: string | null }

type Props = {
  id?: string
  value: string
  onChange: (value: string) => void
  options: SearchableOption[]
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  disabled?: boolean
  className?: string
  'aria-invalid'?: boolean
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  className,
  'aria-invalid': ariaInvalid,
  id: idProp,
}: Props) {
  const autoId = useId()
  const id = idProp ?? autoId
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return options
    return options.filter((o) => {
      const hay = `${o.label} ${o.sublabel ?? ''}`.toLowerCase()
      return hay.includes(t)
    })
  }, [options, q])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    if (!open) setQ('')
  }, [open])

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={ariaInvalid}
        className={cn(
          'flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-start text-sm text-slate-900',
          disabled && 'cursor-not-allowed opacity-60',
          ariaInvalid && 'border-red-400 ring-1 ring-red-200',
        )}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-slate-500')}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="shrink-0 text-slate-400">{open ? '▴' : '▾'}</span>
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5">
          <div className="border-b border-slate-100 p-2">
            <input
              type="search"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none ring-primary focus:ring-2"
              aria-label={searchPlaceholder}
            />
          </div>
          <ul
            role="listbox"
            className="max-h-56 overflow-y-auto py-1 text-sm"
            aria-labelledby={id}
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-slate-500">{emptyText}</li>
            ) : (
              filtered.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    className={cn(
                      'flex w-full flex-col items-start gap-0.5 px-3 py-2 text-start hover:bg-violet-50',
                      o.value === value && 'bg-violet-50',
                    )}
                    onClick={() => {
                      onChange(o.value)
                      setOpen(false)
                    }}
                  >
                    <span className="text-slate-900">{o.label}</span>
                    {o.sublabel ? <span className="text-xs text-slate-500">{o.sublabel}</span> : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
