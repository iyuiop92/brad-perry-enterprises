'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// Slim "drop right in" composer that sits under the dashboard ticker.
// Submitting queues the message to the SAME bridge pipeline the full
// /dashboard/bridge chat uses (POST /api/bridge, target 'claude'/Wendy),
// then routes the user into that thread so the reply appears there.
export default function QuickChatComposer() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Brad wants the box ready to type on open, like Telegram opening on compose.
  // TODO: toggle if keyboard-pop is unwanted
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function submit() {
    const content = value.trim()
    if (!content || sending) return
    setSending(true)
    try {
      await fetch('/api/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, target: 'claude' }),
      })
    } catch {
      // Non-fatal: the full Bridge view polls the thread and will surface state.
    } finally {
      // Land in the live thread whether or not the POST resolved cleanly —
      // the message is queued and Bridge will show it (or the error).
      router.push('/dashboard/bridge')
    }
  }

  const empty = value.trim().length === 0

  return (
    <div
      style={{
        flexShrink: 0,
        position: 'relative',
        zIndex: 20,
        background: 'rgba(0,0,0,0.4)',
        borderBottom: '1px solid rgba(0,180,255,0.06)',
        padding: '6px 12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          maxWidth: 560,
          margin: '0 auto',
        }}
      >
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void submit()
            }
          }}
          placeholder="Message Wendy…"
          disabled={sending}
          aria-label="Message Wendy"
          style={{
            flex: 1,
            height: 30,
            padding: '0 12px',
            fontSize: 13,
            fontFamily: 'var(--font-outfit)',
            color: '#e2e8f0',
            background: 'rgba(13,13,26,0.9)',
            border: '1px solid rgba(0,180,255,0.13)',
            borderRadius: 10,
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={empty || sending}
          aria-label="Send message to Wendy"
          style={{
            flexShrink: 0,
            width: 30,
            height: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
            border: '1px solid rgba(0,180,255,0.13)',
            background: empty ? 'rgba(13,13,26,0.9)' : '#00b4ff',
            color: empty ? '#334155' : '#04040a',
            cursor: empty || sending ? 'default' : 'pointer',
            opacity: sending ? 0.6 : 1,
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22l-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
