'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'sais:wishlist'
const CHANGE_EVENT = 'sais:wishlist-change'

function read(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function write(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Private mode / quota exceeded — the wishlist simply stays in memory.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/**
 * Wishlist kept on the device — no account required, matching the store's
 * "order on WhatsApp" model. The list survives reloads and is shared between
 * every card on the page through a lightweight event.
 */
export function useWishlist() {
  const [ids, setIds] = useState<string[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setIds(read())
    setReady(true)

    const sync = () => setIds(read())
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const toggle = useCallback((id: string) => {
    const current = read()
    const next = current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id]
    write(next)
  }, [])

  const isLiked = useCallback((id: string) => ids.includes(id), [ids])

  return { ids, toggle, isLiked, count: ids.length, ready }
}
