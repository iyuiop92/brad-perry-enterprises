'use client'
import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import type { InboxItem } from '@/lib/types'

export default function InboxStrip() {
  const [items, setItems]   = useState<InboxItem[]>([])
  const [value, setValue]   = useState('')
  const [ripple, setRipple] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/inbox')
      .then(r => r.json())
      .then(setItems)
      .catch(() => {})
  }, [])

  async function capture() {
    const text = value.trim()
    if (!text) return
    setValue('')
    setRipple(true)
    setTimeout(() => setRipple(false), 600)

    const res = await fetch('/api/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    })
    if (res.ok) {
      const item: InboxItem = await res.json()
      setItems(prev => [item, ...prev])
    }
  }

  async function dismiss(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await fetch(`/api/inbox/${id}`, { method: 'DELETE' })
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') capture()
  }

  const visible = items.slice(0, 12)
  const overflow = items.length - 12

  return (
    <div
      className="rounded-[12px] p-4"
      style={{
        background: 'rgba(13,13,26,0.7)',
        border: '1px solid rgba(0,180,255,0.12)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] uppercase tracking-[0.2em] font-[700]" style={{ color: '#475569' }}>
          Inbox
        </span>
        {items.length > 0 && (
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full font-[600]"
            style={{ background: 'rgba(0,180,255,0.1)', color: '#00b4ff' }}
          >
            {items.length}
          </span>
        )}
      </div>

      {/* Capture input */}
      <div className="relative flex items-center mb-3">
        <div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            animation: ripple ? 'inbox-ripple 0.6s ease-out forwards' : 'none',
            border: '1px solid rgba(0,180,255,0.5)',
          }}
        />
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKey}
          placeholder="Capture something... (Enter to save)"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            background: '#04040a',
            border: '1px solid rgba(0,180,255,0.15)',
            color: '#e2e8f0',
          }}
        />
        {value && (
          <button
            onClick={capture}
            className="absolute right-2 text-[10px] font-[700] px-2 py-0.5 rounded"
            style={{ color: '#00b4ff', background: 'rgba(0,180,255,0.1)' }}
          >
            ↵
          </button>
        )}
      </div>

      {/* Items */}
      {visible.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {visible.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs"
              style={{
                background: 'rgba(100,116,139,0.12)',
                border: '1px solid rgba(100,116,139,0.2)',
                color: '#94a3b8',
                maxWidth: 280,
              }}
            >
              <span className="truncate">{item.content}</span>
              <button
                onClick={() => dismiss(item.id)}
                className="shrink-0 opacity-40 hover:opacity-100 transition-opacity"
                style={{ color: '#94a3b8', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          ))}
          {overflow > 0 && (
            <span className="text-[11px] self-center" style={{ color: '#475569' }}>
              +{overflow} more
            </span>
          )}
        </div>
      )}

      {visible.length === 0 && (
        <p className="text-xs" style={{ color: '#334155' }}>
          Nothing captured yet — type anything above and hit Enter
        </p>
      )}
    </div>
  )
}
