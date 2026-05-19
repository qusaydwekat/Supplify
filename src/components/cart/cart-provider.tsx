'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { CartItem } from '@/types/cart'
import { supabaseBrowser } from '@/lib/supabase/client'

const STORAGE_PREFIX = 'supplify-cart-v1'

function storageKeyForUser(userId: string | null) {
  return `${STORAGE_PREFIX}:${userId ?? 'guest'}`
}

type CartContextValue = {
  items: CartItem[]
  supplierId: string | null
  supplierLabel: string | null
  supplierCurrency: string
  isOpen: boolean
  setOpen: (open: boolean) => void
  addItem: (item: CartItem, supplierLabel?: string, supplierCurrency?: string) => void
  replaceCartWithItems: (
    nextItems: CartItem[],
    nextSupplierId: string,
    nextSupplierLabel: string,
    nextSupplierCurrency?: string,
  ) => void
  updateQuantity: (variationId: string, quantity: number) => void
  removeItem: (variationId: string) => void
  clearCart: () => void
  switchDialog: null | { item: CartItem; supplierLabel: string; otherSupplierLabel: string }
  confirmSwitchSupplier: () => void
  cancelSwitchSupplier: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

function loadFromStorage(key: string): {
  items: CartItem[]
  supplierId: string | null
  supplierLabel: string | null
  supplierCurrency: string
} {
  if (typeof window === 'undefined') {
    return { items: [], supplierId: null, supplierLabel: null, supplierCurrency: 'USD' }
  }
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { items: [], supplierId: null, supplierLabel: null, supplierCurrency: 'USD' }
    const parsed = JSON.parse(raw) as {
      items?: CartItem[]
      supplierId?: string | null
      supplierLabel?: string | null
      supplierCurrency?: string | null
    }
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      supplierId: parsed.supplierId ?? null,
      supplierLabel: parsed.supplierLabel ?? null,
      supplierCurrency: parsed.supplierCurrency?.trim() ? parsed.supplierCurrency.trim().toUpperCase() : 'USD',
    }
  } catch {
    return { items: [], supplierId: null, supplierLabel: null, supplierCurrency: 'USD' }
  }
}

function saveToStorage(
  key: string,
  items: CartItem[],
  supplierId: string | null,
  supplierLabel: string | null,
  supplierCurrency: string,
) {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify({ items, supplierId, supplierLabel, supplierCurrency }))
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [supplierLabel, setSupplierLabel] = useState<string | null>(null)
  const [supplierCurrency, setSupplierCurrency] = useState('USD')
  const [hydrated, setHydrated] = useState(false)
  const [isOpen, setOpen] = useState(false)
  const [cartUserId, setCartUserId] = useState<string | null>(null)
  const [switchDialog, setSwitchDialog] = useState<null | {
    item: CartItem
    supplierLabel: string
    otherSupplierLabel: string
  }>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = supabaseBrowser()

    async function boot() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const uid = user?.id ?? null
      if (cancelled) return
      setCartUserId(uid)
      const s = loadFromStorage(storageKeyForUser(uid))
      setItems(s.items)
      setSupplierId(s.supplierId)
      setSupplierLabel(s.supplierLabel)
      setSupplierCurrency(s.supplierCurrency)
      setHydrated(true)
    }

    boot()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const uid = session?.user?.id ?? null
      if (cancelled) return
      setCartUserId(uid)
      const s = loadFromStorage(storageKeyForUser(uid))
      setItems(s.items)
      setSupplierId(s.supplierId)
      setSupplierLabel(s.supplierLabel)
      setSupplierCurrency(s.supplierCurrency)
      setSwitchDialog(null)
      setOpen(false)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveToStorage(storageKeyForUser(cartUserId), items, supplierId, supplierLabel, supplierCurrency)
  }, [items, supplierId, supplierLabel, supplierCurrency, hydrated, cartUserId])

  const clearCart = useCallback(() => {
    setItems([])
    setSupplierId(null)
    setSupplierLabel(null)
    setSupplierCurrency('USD')
  }, [])

  const replaceCartWithItems = useCallback(
    (nextItems: CartItem[], nextSupplierId: string, nextSupplierLabel: string, nextSupplierCurrency = 'USD') => {
      setItems(nextItems.map((i) => ({ ...i })))
      setSupplierId(nextSupplierId)
      setSupplierLabel(nextSupplierLabel)
      setSupplierCurrency(nextSupplierCurrency)
      setSwitchDialog(null)
    },
    [],
  )

  const addItem = useCallback(
    (item: CartItem, label?: string, currencyCode = 'USD') => {
      const nextLabel = label ?? 'This supplier'

      if (items.length === 0) {
        setSupplierId(item.supplierId)
        setSupplierLabel(nextLabel)
        setSupplierCurrency(currencyCode)
        setItems([{ ...item, quantity: item.quantity }])
        return
      }

      if (item.supplierId !== supplierId) {
        setSwitchDialog({
          item,
          supplierLabel: supplierLabel ?? 'your current supplier',
          otherSupplierLabel: nextLabel,
        })
        return
      }

      setItems((prev) => {
        const idx = prev.findIndex((i) => i.variationId === item.variationId)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = {
            ...next[idx],
            quantity: next[idx].quantity + item.quantity,
            unitPrice: item.unitPrice,
          }
          return next
        }
        return [...prev, { ...item }]
      })
    },
    [items.length, supplierId, supplierLabel],
  )

  const confirmSwitchSupplier = useCallback(() => {
    if (!switchDialog) return
    const { item, otherSupplierLabel } = switchDialog
    setItems([{ ...item }])
    setSupplierId(item.supplierId)
    setSupplierLabel(otherSupplierLabel)
    setSupplierCurrency(item.supplierCurrency ?? 'USD')
    setSwitchDialog(null)
  }, [switchDialog])

  const cancelSwitchSupplier = useCallback(() => {
    setSwitchDialog(null)
  }, [])

  const removeItem = useCallback((variationId: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.variationId !== variationId)
      if (next.length === 0) {
        setSupplierId(null)
        setSupplierLabel(null)
        setSupplierCurrency('USD')
      }
      return next
    })
  }, [])

  const updateQuantity = useCallback(
    (variationId: string, quantity: number) => {
      if (quantity < 1) {
        removeItem(variationId)
        return
      }
      setItems((prev) =>
        prev.map((i) => (i.variationId === variationId ? { ...i, quantity } : i)),
      )
    },
    [removeItem],
  )

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      supplierId,
      supplierLabel,
      supplierCurrency,
      isOpen,
      setOpen,
      addItem,
      replaceCartWithItems,
      updateQuantity,
      removeItem,
      clearCart,
      switchDialog,
      confirmSwitchSupplier,
      cancelSwitchSupplier,
    }),
    [
      items,
      supplierId,
      supplierLabel,
      supplierCurrency,
      isOpen,
      addItem,
      replaceCartWithItems,
      updateQuantity,
      removeItem,
      clearCart,
      switchDialog,
      confirmSwitchSupplier,
      cancelSwitchSupplier,
    ],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCartContext() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCartContext must be used within CartProvider')
  return ctx
}
