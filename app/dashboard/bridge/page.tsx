'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Target = 'claude' | 'codex' | 'both'
type Role = 'user' | 'claude' | 'codex' | 'system'

type Message = {
  id: string
  role: Role
  target: Target | null
  content: string
  status: 'pending' | 'processing' | 'done' | 'error'
  error: string | null
  created_at: string
}

const ROLE_META: Record<Role, { label: string; color: string }> = {
  user: { label: 'You', color: '#e2e8f0' },
  claude: { label: 'Wendy', color: '#00b4ff' },
  codex: { label: 'Ellie', color: '#fb923c' },
  system: { label: 'System', color: '#64748b' },
}

export default function BridgePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [target, setTarget] = useState<Target>('claude')
  const [sending, setSending] = useState(false)
  const sinceRef = useRef<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const poll = useCallback(async () => {
    const qs = sinceRef.current ? `?since=${encodeURIComponent(sinceRef.current)}` : ''
    const res = await fetch(`/api/bridge${qs}`, { cache: 'no-store' })
    if (!res.ok) return
    const rows: Message[] = await res.json()
    if (!rows.length) return
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]))
      for (const r of rows) byId.set(r.id, r)
      return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at))
    })
    sinceRef.current = rows[rows.length - 1].created_at
  }, [])

  useEffect(() => {
    poll()
    const t = setInterval(poll, 1500)
    return () => clearInterval(t)
  }, [poll])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    setInput('')
    try {
      await fetch('/api/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, target }),
      })
      await poll()
    } finally {
      setSending(false)
    }
  }

  const waiting = messages.some((m) => m.role === 'user' && (m.status === 'pending' || m.status === 'processing'))

  return (
    <div
      style={{ background: '#04040a', minHeight: '100vh', paddingTop: 'calc(3.5rem + env(safe-area-inset-top))' }}
      className="flex flex-col"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-40">
        <header className="py-4">
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: '#64748b' }}>Command Bridge</p>
          <h1 className="mt-1 text-2xl font-[800] text-white" style={{ fontFamily: 'var(--font-outfit)' }}>Talk to your builders</h1>
          <p className="mt-1 text-xs" style={{ color: '#475569' }}>
            Messages route to your terminal agents on this Mac. The worker must be running.
          </p>
        </header>

        <div className="flex-1 space-y-3">
          {messages.length === 0 && (
            <p className="mt-8 text-center text-sm" style={{ color: '#475569' }}>
              No messages yet. Ask Wendy or Ellie something below.
            </p>
          )}
          {messages.map((m) => {
            const meta = ROLE_META[m.role]
            const mine = m.role === 'user'
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <span className="mb-1 text-[10px] font-[700] uppercase tracking-wider" style={{ color: meta.color }}>
                  {meta.label}
                  {mine && m.target === 'both' ? ' → both' : mine && m.target === 'codex' ? ' → Ellie' : ''}
                </span>
                <div
                  className="max-w-[85%] whitespace-pre-wrap rounded-[10px] px-3.5 py-2.5 text-sm leading-relaxed"
                  style={{
                    background: mine ? 'rgba(0,180,255,0.10)' : '#0d0d1a',
                    border: `1px solid ${mine ? 'rgba(0,180,255,0.20)' : 'rgba(255,255,255,0.06)'}`,
                    color: m.status === 'error' ? '#f87171' : '#e2e8f0',
                  }}
                >
                  {m.status === 'error' ? (m.error || 'Something went wrong.') : m.content}
                </div>
                {mine && m.status !== 'done' && m.status !== 'error' && (
                  <span className="mt-1 text-[10px]" style={{ color: '#475569' }}>
                    {m.status === 'processing' ? 'working…' : 'queued'}
                  </span>
                )}
              </div>
            )
          })}
          {waiting && (
            <div className="flex items-center gap-2 text-xs" style={{ color: '#475569' }}>
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: '#00b4ff' }} />
              Waiting on a reply…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div
        className="fixed inset-x-0 bottom-0"
        style={{ background: 'rgba(4,4,10,0.98)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto w-full max-w-2xl px-4 py-3">
          <div className="mb-2 flex gap-1.5">
            {(['claude', 'codex', 'both'] as Target[]).map((t) => (
              <button
                key={t}
                onClick={() => setTarget(t)}
                className="rounded-[8px] px-3 py-1 text-[11px] font-[700] uppercase tracking-wider transition"
                style={{
                  background: target === t ? 'rgba(0,180,255,0.15)' : 'transparent',
                  border: `1px solid ${target === t ? 'rgba(0,180,255,0.4)' : 'rgba(255,255,255,0.10)'}`,
                  color: target === t ? '#00b4ff' : '#64748b',
                }}
              >
                {t === 'claude' ? 'Wendy' : t === 'codex' ? 'Ellie' : 'Both'}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              rows={1}
              placeholder={`Message ${target === 'both' ? 'both agents' : target === 'codex' ? 'Ellie' : 'Wendy'}…`}
              className="flex-1 resize-none rounded-[10px] px-3.5 py-2.5 text-sm outline-none"
              style={{ background: '#0d0d1a', border: '1px solid rgba(0,180,255,0.13)', color: '#e2e8f0', maxHeight: 160 }}
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="rounded-[10px] px-4 py-2.5 text-sm font-[700] transition disabled:opacity-40"
              style={{ background: '#00b4ff', color: '#04040a' }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
