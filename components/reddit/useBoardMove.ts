'use client'

import { useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

export function useBoardMove<T extends { id: string; status: string }>(endpoint: string, setItems: Dispatch<SetStateAction<T[]>>) {
  const pending = useRef(false)
  const [moving, setMoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  async function move(id: string, status: T['status']) {
    if (pending.current) return
    pending.current = true
    setMoving(true)
    setError(null)
    try {
      const response = await fetch(`${endpoint}/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      })
      if (!response.ok) throw new Error('Move failed')
      const saved = await response.json() as T
      setItems(items => items.map(item => item.id === id ? { ...item, status: saved.status, ...('posted_at' in saved ? { posted_at: saved.posted_at } : {}) } : item))
    } catch {
      setError('Could not save the move. The card stayed in its original stage. Please try again.')
    } finally {
      pending.current = false
      setMoving(false)
    }
  }

  return { move, moving, error, draggedId, setDraggedId }
}
