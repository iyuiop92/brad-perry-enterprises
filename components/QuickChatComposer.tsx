'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// A picked-but-not-yet-sent image (previewed as a chip before send).
type PendingImage = { id: string; filename: string; mime: string; dataUrl: string }

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Slim "drop right in" composer. On desktop it sits under the dashboard ticker;
// on mobile CSS docks it to the bottom of the screen (Telegram-style).
// Submitting queues the message + any images to the SAME bridge pipeline the
// full /dashboard/bridge chat uses (POST /api/bridge, target 'claude'/Wendy),
// then routes the user into that thread so the reply appears there.
export default function QuickChatComposer() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Brad wants the box ready to type on open, like Telegram opening on compose.
  // TODO: toggle if keyboard-pop is unwanted
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // let the same file be picked again later
    const images = files.filter(f => f.type.startsWith('image/'))
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
    if (loaded.length) setPendingImages(prev => [...prev, ...loaded])
  }

  function removePending(id: string) {
    setPendingImages(prev => prev.filter(p => p.id !== id))
  }

  async function submit() {
    const content = value.trim()
    if ((!content && pendingImages.length === 0) || sending) return
    setSending(true)
    const attachments = pendingImages.map(p => ({
      data_url: p.dataUrl,
      filename: p.filename,
      mime: p.mime,
    }))
    try {
      await fetch('/api/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, target: 'claude', attachments }),
      })
    } catch {
      // Non-fatal: the full Bridge view polls the thread and will surface state.
    } finally {
      // Land in the live thread whether or not the POST resolved cleanly —
      // the message is queued and Bridge will show it (or the error).
      router.push('/dashboard/bridge')
    }
  }

  const empty = value.trim().length === 0 && pendingImages.length === 0

  return (
    <div
      className="dashboard-quick-composer"
      style={{
        flexShrink: 0,
        position: 'relative',
        zIndex: 20,
        background: 'rgba(0,0,0,0.4)',
        borderBottom: '1px solid rgba(0,180,255,0.06)',
        padding: '6px 12px',
      }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {pendingImages.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            {pendingImages.map(p => (
              <div
                key={p.id}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 10,
                  border: '1px solid rgba(0,180,255,0.25)',
                  width: 48,
                  height: 48,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.dataUrl}
                  alt={p.filename}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <button
                  type="button"
                  onClick={() => removePending(p.id)}
                  aria-label={`Remove ${p.filename}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: 16,
                    height: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    background: 'rgba(4,4,10,0.85)',
                    color: '#f87171',
                    border: 'none',
                    borderBottomLeftRadius: 10,
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={onPickFiles}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            aria-label="Attach images"
            style={{
              flexShrink: 0,
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              border: '1px solid rgba(0,180,255,0.13)',
              background: 'rgba(13,13,26,0.9)',
              color: '#00b4ff',
              cursor: sending ? 'default' : 'pointer',
              opacity: sending ? 0.6 : 1,
            }}
          >
            {/* paperclip */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
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
              minWidth: 0,
              height: 30,
              padding: '0 12px',
              fontSize: 16,
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
    </div>
  )
}
