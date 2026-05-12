'use client'

import { useEffect, useRef, useState } from 'react'

interface FeedMessage {
  id: string
  role: 'wendy' | 'brad' | 'system'
  content: string
  metadata: Record<string, unknown>
  created_at: string
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/Phoenix',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export default function PersonalFeed() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<FeedMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/personal/feed')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMessages(data)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [open, messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return

    const optimistic: FeedMessage = {
      id: `opt-${Date.now()}`,
      role: 'brad',
      content: text,
      metadata: {},
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setInput('')
    setSending(true)

    try {
      const res = await fetch('/api/personal/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      if (data.reply) {
        const reply: FeedMessage = {
          id: `rep-${Date.now()}`,
          role: 'wendy',
          content: data.reply,
          metadata: {},
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, reply])
      }
    } catch {
      // leave optimistic message, let user retry
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const latestWendy = [...messages].reverse().find((m) => m.role === 'wendy')

  return (
    <div
      style={{
        background: '#0d0d1a',
        borderBottom: '1px solid rgba(0, 180, 255, 0.13)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Collapsed strip */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between px-4"
          style={{ height: '48px', cursor: 'pointer', background: 'transparent', border: 'none' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="text-xs font-[700] uppercase tracking-widest shrink-0"
              style={{ color: '#00b4ff' }}
            >
              Wendy
            </span>
            {loading ? (
              <span className="text-xs truncate" style={{ color: '#334155' }}>Loading...</span>
            ) : latestWendy ? (
              <span className="text-xs truncate" style={{ color: '#64748b' }}>
                {latestWendy.content.split('\n')[0].replace(/^[*_#]+/, '').trim()}
              </span>
            ) : (
              <span className="text-xs" style={{ color: '#334155' }}>No messages yet</span>
            )}
          </div>
          <span className="text-xs shrink-0 ml-2" style={{ color: '#334155' }}>▾</span>
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div className="flex flex-col" style={{ height: '420px' }}>
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 shrink-0"
            style={{
              height: '44px',
              borderBottom: '1px solid rgba(0, 180, 255, 0.08)',
            }}
          >
            <span
              className="text-xs font-[700] uppercase tracking-widest"
              style={{ color: '#00b4ff' }}
            >
              Wendy — Personal Feed
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-xs"
              style={{ color: '#334155', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ▴ collapse
            </button>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}
          >
            {loading && (
              <p className="text-xs text-center" style={{ color: '#334155' }}>Loading...</p>
            )}
            {!loading && messages.length === 0 && (
              <p className="text-xs text-center" style={{ color: '#334155' }}>
                Morning brief arrives at 4am. Say hi anytime.
              </p>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col gap-0.5 ${msg.role === 'brad' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className="text-xs px-3 py-2 rounded-[10px] max-w-[85%]"
                  style={
                    msg.role === 'brad'
                      ? { background: 'rgba(0, 180, 255, 0.12)', color: '#e2e8f0' }
                      : { background: '#161626', color: '#cbd5e1' }
                  }
                >
                  <span style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{msg.content}</span>
                </div>
                <span className="text-[10px] px-1" style={{ color: '#1e293b' }}>
                  {msg.role === 'wendy' ? 'Wendy · ' : ''}{formatTime(msg.created_at)}
                </span>
              </div>
            ))}
            {sending && (
              <div className="flex items-start">
                <div
                  className="text-xs px-3 py-2 rounded-[10px]"
                  style={{ background: '#161626', color: '#334155' }}
                >
                  Wendy is thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            className="shrink-0 flex gap-2 px-4 py-2.5"
            style={{ borderTop: '1px solid rgba(0, 180, 255, 0.08)' }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Wendy..."
              rows={1}
              className="flex-1 resize-none rounded-[8px] px-3 py-2 text-xs outline-none"
              style={{
                background: '#04040a',
                border: '1px solid rgba(0, 180, 255, 0.13)',
                color: '#e2e8f0',
                lineHeight: '1.5',
              }}
              onFocus={(e) => {
                e.currentTarget.style.border = '1px solid rgba(0, 180, 255, 0.4)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = '1px solid rgba(0, 180, 255, 0.13)'
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="shrink-0 rounded-[8px] px-3 py-2 text-xs font-[600] transition-all disabled:opacity-30"
              style={{ background: '#00b4ff', color: '#04040a' }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
