'use client'
import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import type { InboxItem } from '@/lib/types'

export default function InboxStrip() {
  const [items, setItems]   = useState<InboxItem[]>([])
  const [value, setValue]   = useState('')
  const [ripple, setRipple] = useState(false)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/inbox').then(r => r.json()).then(setItems).catch(() => {})
  }, [])

  async function capture() {
    const text = value.trim()
    if (!text) return
    setValue('')
    setRipple(true)
    setTimeout(() => setRipple(false), 500)
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

  const visible  = items.slice(0, 10)
  const overflow = items.length - 10

  return (
    <div
      className="rounded-[14px] overflow-hidden transition-all duration-300"
      style={{
        background: 'rgba(8,8,20,0.7)',
        border: `1px solid ${focused ? 'rgba(0,180,255,0.2)' : 'rgba(255,255,255,0.05)'}`,
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Terminal header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ef4444' }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#f59e0b' }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#22c55e' }} />
          </div>
          <span className="text-[10px] font-[600] uppercase tracking-[0.2em]" style={{ color: '#283044' }}>
            inbox
          </span>
          {items.length > 0 && (
            <span
              className="text-[9px] font-[700] px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(0,180,255,0.1)', color: '#00b4ff' }}
            >
              {items.length}
            </span>
          )}
        </div>
        <span className="text-[9px] font-[500]" style={{ color: '#1e293b' }}>
          press enter to capture
        </span>
      </div>

      {/* Input row */}
      <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: items.length > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
        <span className="text-xs font-[700] shrink-0" style={{ color: '#00b4ff' }}>›</span>
        <div className="relative flex-1">
          {ripple && (
            <div
              className="absolute inset-0 rounded pointer-events-none"
              style={{ animation: 'inbox-ripple 0.5s ease-out forwards', border: '1px solid rgba(0,180,255,0.6)' }}
            />
          )}
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={onKey}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Capture a thought, idea, or reminder..."
            className="w-full bg-transparent outline-none text-sm"
            style={{ color: '#cbd5e1', caretColor: '#00b4ff' }}
          />
        </div>
        {value && (
          <button
            onClick={capture}
            className="shrink-0 text-[10px] font-[700] px-2.5 py-1 rounded-md transition-opacity hover:opacity-80"
            style={{ background: 'rgba(0,180,255,0.12)', color: '#00b4ff', border: '1px solid rgba(0,180,255,0.2)' }}
          >
            SAVE
          </button>
        )}
      </div>

      {/* Captured items */}
      {visible.length > 0 && (
        <div className="px-5 py-3 flex flex-wrap gap-2">
          {visible.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs group"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#64748b',
                maxWidth: 320,
              }}
            >
              <span className="truncate">{item.content}</span>
              <button
                onClick={() => dismiss(item.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none"
                style={{ color: '#475569' }}
              >
                ×
              </button>
            </div>
          ))}
          {overflow > 0 && (
            <span className="text-[10px] self-center" style={{ color: '#283044' }}>
              +{overflow} more
            </span>
          )}
        </div>
      )}
    </div>
  )
}
