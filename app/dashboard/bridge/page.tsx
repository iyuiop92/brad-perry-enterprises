'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Target = 'claude' | 'codex' | 'both'
type Role = 'user' | 'claude' | 'codex' | 'system'

type Attachment = { storage_path: string; mime: string; filename: string }

type Message = {
  id: string
  role: Role
  target: Target | null
  content: string
  status: 'pending' | 'processing' | 'done' | 'error'
  error: string | null
  attachments: Attachment[] | null
  created_at: string
}

// A picked-but-not-yet-sent image (previewed as a chip before send).
type PendingImage = { id: string; filename: string; mime: string; dataUrl: string }

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

const ROLE_META: Record<Role, { label: string; color: string }> = {
  user: { label: 'You', color: '#e2e8f0' },
  claude: { label: 'Wendy', color: '#00b4ff' },
  codex: { label: 'Ellie', color: '#fb923c' },
  system: { label: 'System', color: '#64748b' },
}

export default function BridgePage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [target, setTarget] = useState<Target>('claude')
  const [sending, setSending] = useState(false)
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const sinceRef = useRef<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  // Land with the cursor ready to type, like Telegram's compose box.
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // let the same file be picked again later
    const images = files.filter((f) => f.type.startsWith('image/'))
    const loaded: PendingImage[] = []
    for (const f of images) {
      try {
        const dataUrl = await readFileAsDataUrl(f)
        loaded.push({
          id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2)}`,
          filename: f.name,
          mime: f.type,
          dataUrl,
        })
      } catch {
        // skip unreadable file
      }
    }
    if (loaded.length) setPendingImages((prev) => [...prev, ...loaded])
  }

  function removePending(id: string) {
    setPendingImages((prev) => prev.filter((p) => p.id !== id))
  }

  async function send() {
    const content = input.trim()
    if ((!content && pendingImages.length === 0) || sending) return
    setSending(true)
    setInput('')
    const attachments = pendingImages.map((p) => ({
      data_url: p.dataUrl,
      filename: p.filename,
      mime: p.mime,
    }))
    setPendingImages([])
    try {
      await fetch('/api/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, target, attachments }),
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
      {/* Always-visible close — returns to the dashboard without reloading the app. */}
      <button
        onClick={() => router.push('/dashboard')}
        aria-label="Close chat"
        className="fixed z-[200] flex items-center justify-center rounded-[10px]"
        style={{
          top: 'calc(env(safe-area-inset-top) + 8px)',
          right: 12,
          width: 44,
          height: 44,
          background: 'rgba(13,13,26,0.92)',
          border: '1px solid rgba(0,180,255,0.28)',
          color: '#e2e8f0',
          cursor: 'pointer',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 6 6 18" /><path d="m6 6 12 12" />
        </svg>
      </button>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-40">
        <header className="py-4 pr-14">
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
                  className="max-w-[85%] whitespace-pre-wrap rounded-[10px] px-3.5 py-2.5 text-[16px] leading-relaxed"
                  style={{
                    background: mine ? 'rgba(0,180,255,0.10)' : '#0d0d1a',
                    border: `1px solid ${mine ? 'rgba(0,180,255,0.20)' : 'rgba(255,255,255,0.06)'}`,
                    color: m.status === 'error' ? '#f87171' : '#e2e8f0',
                  }}
                >
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {m.attachments.map((a, i) => (
                        <span
                          key={`${m.id}-att-${i}`}
                          className="inline-flex max-w-[180px] items-center gap-1.5 rounded-[10px] px-2 py-1 text-[12px]"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: '#94a3b8' }}
                          title={a.filename}
                        >
                          <span aria-hidden>🖼</span>
                          <span className="truncate">{a.filename}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {m.status === 'error'
                    ? (m.error || 'Something went wrong.')
                    : m.content || (m.attachments && m.attachments.length ? '' : '')}
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
          {pendingImages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pendingImages.map((p) => (
                <div
                  key={p.id}
                  className="relative overflow-hidden rounded-[10px]"
                  style={{ border: '1px solid rgba(0,180,255,0.25)', width: 56, height: 56 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.dataUrl} alt={p.filename} className="h-full w-full object-cover" />
                  <button
                    onClick={() => removePending(p.id)}
                    aria-label={`Remove ${p.filename}`}
                    className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center text-[11px] font-[700]"
                    style={{ background: 'rgba(4,4,10,0.85)', color: '#f87171', borderBottomLeftRadius: 10 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={onPickFiles}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach images"
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] transition disabled:opacity-40"
              style={{ background: '#0d0d1a', border: '1px solid rgba(0,180,255,0.13)', color: '#00b4ff' }}
              disabled={sending}
            >
              {/* paperclip */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <textarea
              ref={textareaRef}
              autoFocus
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
              className="flex-1 resize-none rounded-[10px] px-3.5 py-2.5 text-[16px] outline-none"
              style={{ background: '#0d0d1a', border: '1px solid rgba(0,180,255,0.13)', color: '#e2e8f0', maxHeight: 160 }}
            />
            <button
              onClick={send}
              disabled={sending || (!input.trim() && pendingImages.length === 0)}
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
