'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const ACCENT = '#00b4ff'

type Item = { text: string; done: boolean }

export default function TodayBigThree() {
  const [items, setItems] = useState<Item[]>([
    { text: '', done: false },
    { text: '', done: false },
    { text: '', done: false },
  ])
  const [loaded, setLoaded] = useState(false)
  const saveTimer = useRef<number | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/big-three')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.items?.length) setItems(d.items)
      })
      .finally(() => {
        if (alive) setLoaded(true)
      })
    return () => {
      alive = false
    }
  }, [])

  const persist = useCallback((next: Item[]) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      fetch('/api/big-three', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: next }),
      }).catch(() => {})
    }, 600)
  }, [])

  const update = useCallback(
    (i: number, patch: Partial<Item>) => {
      setItems((prev) => {
        const next = prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it))
        persist(next)
        return next
      })
    },
    [persist]
  )

  const doneCount = items.filter((i) => i.done && i.text.trim()).length
  const totalSet = items.filter((i) => i.text.trim()).length

  return (
    <div
      className="today-big-three"
      style={{
        flexShrink: 0,
        zIndex: 10,
        margin: '0 16px 8px',
        padding: '10px 14px',
        background: 'rgba(13,13,26,0.7)',
        border: '1px solid rgba(0,180,255,0.18)',
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-outfit)' }}>
          Today&apos;s Big 3
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: doneCount === totalSet && totalSet > 0 ? '#22c55e' : '#64748b' }}>
          {doneCount}/{totalSet || 3} done
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => update(i, { done: !item.done })}
              aria-label={item.done ? 'Mark not done' : 'Mark done'}
              style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: 'pointer',
                border: `1.5px solid ${item.done ? '#22c55e' : 'rgba(255,255,255,0.25)'}`,
                background: item.done ? '#22c55e' : 'transparent',
                color: '#000', fontSize: 12, lineHeight: 1, fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {item.done ? '✓' : ''}
            </button>
            <input
              value={item.text}
              onChange={(e) => update(i, { text: e.target.value })}
              placeholder={`Priority ${i + 1}`}
              disabled={!loaded}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: item.done ? '#64748b' : '#e2e8f0', fontSize: 13,
                textDecoration: item.done ? 'line-through' : 'none', fontFamily: 'inherit',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
