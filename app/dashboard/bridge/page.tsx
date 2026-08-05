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
  const [listening, setListening] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const atBottomRef = useRef(true)
  const lastSigRef = useRef('')
  // Snap instantly to bottom on first load; smooth-scroll on subsequent changes.
  const hasScrolledOnceRef = useRef(false)
  // Set to true when the user sends via voice; triggers TTS on the next agent reply.
  const wasVoiceRef = useRef(false)
  const lastSpokenIdRef = useRef('')
  const recognitionRef = useRef<any>(null)

  const poll = useCallback(async () => {
    const res = await fetch('/api/bridge', { cache: 'no-store' })
    if (!res.ok) return
    const rows: Message[] = await res.json()
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]))
      for (const r of rows) byId.set(r.id, r)
      return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at))
    })
  }, [])

  useEffect(() => {
    poll()
    const t = setInterval(poll, 1500)
    return () => clearInterval(t)
  }, [poll])

  useEffect(() => {
    const onScroll = () => {
      const nearBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 120
      atBottomRef.current = nearBottom
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Snap to bottom instantly on first load; smooth-scroll on new messages after that.
  useEffect(() => {
    const last = messages[messages.length - 1]
    const sig = `${messages.length}:${last?.id ?? ''}:${last?.status ?? ''}`
    if (sig === lastSigRef.current) return
    lastSigRef.current = sig
    if (!hasScrolledOnceRef.current && messages.length > 0) {
      hasScrolledOnceRef.current = true
      bottomRef.current?.scrollIntoView({ behavior: 'instant', block: 'end' })
    } else if (atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages])

  // Speak the latest agent reply when the user sent via voice.
  useEffect(() => {
    if (!wasVoiceRef.current) return
    const last = [...messages]
      .reverse()
      .find((m) => (m.role === 'claude' || m.role === 'codex') && m.status === 'done')
    if (!last || last.id === lastSpokenIdRef.current || !last.content) return
    lastSpokenIdRef.current = last.id
    wasVoiceRef.current = false
    const utt = new SpeechSynthesisUtterance(last.content.slice(0, 600))
    utt.lang = 'en-US'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utt)
  }, [messages])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
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

  // Accepts an optional content override so voice STT can send without waiting
  // for React to flush the setInput state update.
  async function send(contentOverride?: string) {
    const content = (contentOverride ?? input).trim()
    if ((!content && pendingImages.length === 0) || sending) return
    atBottomRef.current = true
    setSending(true)
    if (!contentOverride) setInput('')
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

  async function clearConversation() {
    if (!confirm('Clear all Bridge messages? This cannot be undone.')) return
    await fetch('/api/bridge', { method: 'DELETE' })
    setMessages([])
    lastSigRef.current = ''
    hasScrolledOnceRef.current = false
  }

  function toggleMic() {
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      alert('Voice input is not supported in this browser. Try Chrome or Edge.')
      return
    }
    const r = new SR()
    r.lang = 'en-US'
    r.continuous = false
    r.interimResults = false
    r.onresult = (e: any) => {
      const text: string = e.results[0][0].transcript
      wasVoiceRef.current = true
      setListening(false)
      send(text)
    }
    r.onerror = () => setListening(false)
    r.onend = () => setListening(false)
    r.start()
    recognitionRef.current = r
    setListening(true)
  }

  const waiting = messages.some((m) => m.role === 'user' && (m.status === 'pending' || m.status === 'processing'))

  function agentStatus(key: 'claude' | 'codex'): 'working' | 'error' | 'awake' {
    const working = messages.some(
      (m) => m.role === 'user' && (m.status === 'pending' || m.status === 'processing') && (m.target === key || m.target === 'both'),
    )
    if (working) return 'working'
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === key) return messages[i].status === 'error' ? 'error' : 'awake'
    }
    return 'awake'
  }
  const STATUS_META = {
    working: { text: 'working', color: '#facc15' },
    error: { text: 'needs attention', color: '#f87171' },
    awake: { text: 'ready', color: '#22c55e' },
  } as const

  return (
    <div
      style={{ background: '#04040a', minHeight: '100vh', paddingTop: 'calc(3.5rem + env(safe-area-inset-top))' }}
      className="flex flex-col"
    >
      {/* Close button */}
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
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(['claude', 'codex'] as const).map((key) => {
              const s = STATUS_META[agentStatus(key)]
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1 text-[11px] font-[700]"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: ROLE_META[key].color }}
                >
                  <span
                    className={agentStatus(key) === 'working' ? 'h-1.5 w-1.5 animate-pulse rounded-full' : 'h-1.5 w-1.5 rounded-full'}
                    style={{ background: s.color }}
                    aria-hidden
                  />
                  {ROLE_META[key].label}
                  <span style={{ color: s.color, fontWeight: 400 }}>{s.text}</span>
                </span>
              )
            })}
            {/* Clear conversation */}
            <button
              onClick={clearConversation}
              aria-label="Clear conversation"
              className="ml-auto inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1 text-[11px] font-[700] transition"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)', color: '#f87171' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" />
              </svg>
              Clear
            </button>
          </div>
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
                    ? (m.content || m.error || 'Something went wrong.')
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
            {/* Attach images */}
            <button
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach images"
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] transition disabled:opacity-40"
              style={{ background: '#0d0d1a', border: '1px solid rgba(0,180,255,0.13)', color: '#00b4ff' }}
              disabled={sending}
            >
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
              placeholder={listening ? 'Listening…' : `Message ${target === 'both' ? 'both agents' : target === 'codex' ? 'Ellie' : 'Wendy'}…`}
              className="flex-1 resize-none rounded-[10px] px-3.5 py-2.5 text-[16px] outline-none"
              style={{ background: '#0d0d1a', border: '1px solid rgba(0,180,255,0.13)', color: '#e2e8f0', maxHeight: 160 }}
            />
            {/* Mic — tap to speak, auto-sends transcript, speaks the reply back */}
            <button
              onClick={toggleMic}
              aria-label={listening ? 'Stop listening' : 'Speak a message'}
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] transition"
              style={{
                background: listening ? 'rgba(248,113,113,0.15)' : '#0d0d1a',
                border: `1px solid ${listening ? 'rgba(248,113,113,0.45)' : 'rgba(0,180,255,0.13)'}`,
                color: listening ? '#f87171' : '#64748b',
              }}
            >
              {listening ? (
                // Pulsing stop indicator while recording
                <span className="h-3 w-3 animate-pulse rounded-full" style={{ background: '#f87171' }} aria-hidden />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>
            <button
              onClick={() => send()}
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
