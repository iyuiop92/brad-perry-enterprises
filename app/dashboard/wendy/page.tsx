'use client'

import { useState, useRef } from 'react'

type Phase = 'init' | 'listening' | 'thinking' | 'speaking'
type Message = { role: 'user' | 'assistant'; content: string }

const PHASE_LABEL: Record<Phase, string> = {
  init:      'Tap to start',
  listening: 'Listening...',
  thinking:  'Thinking...',
  speaking:  'Speaking...',
}

const PHASE_COLOR: Record<Phase, string> = {
  init:      '#64748b',
  listening: '#00b4ff',
  thinking:  '#fbbf24',
  speaking:  '#34d399',
}

export default function WendyVoicePage() {
  const [phase, setPhase]         = useState<Phase>('init')
  const [transcript, setTranscript] = useState('')
  const [last, setLast]           = useState<{ you: string; wendy: string } | null>(null)
  const [error, setError]         = useState('')

  const phaseRef   = useRef<Phase>('init')
  const historyRef = useRef<Message[]>([])
  const recRef     = useRef<any>(null)

  function go(p: Phase) { phaseRef.current = p; setPhase(p) }

  function stopRec() { try { recRef.current?.stop() } catch {} }

  function startRec() {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) { setError('Voice requires Chrome or Safari'); return }

    const rec = new SR()
    rec.continuous    = false
    rec.interimResults = true
    rec.lang          = 'en-US'

    rec.onresult = (e: any) => {
      const r = e.results[e.results.length - 1]
      setTranscript(r[0].transcript)
      if (r.isFinal) handleUtterance(r[0].transcript)
    }

    rec.onend = () => {
      if (phaseRef.current === 'listening') {
        setTimeout(() => { try { rec.start() } catch {} }, 150)
      }
    }

    rec.onerror = (e: any) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      if (phaseRef.current === 'listening') {
        setTimeout(() => { try { rec.start() } catch {} }, 1000)
      }
    }

    recRef.current = rec
    try { rec.start() } catch {}
    go('listening')
    setTranscript('')
    setError('')
  }

  async function handleUtterance(text: string) {
    stopRec()
    go('thinking')
    setTranscript('')

    try {
      const chatRes = await fetch('/api/wendy/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text, history: historyRef.current.slice(-8) }),
      })
      const { reply, error: chatErr } = await chatRes.json()
      if (!reply) throw new Error(chatErr ?? 'No reply')

      historyRef.current = [
        ...historyRef.current,
        { role: 'user',      content: text  },
        { role: 'assistant', content: reply },
      ]
      setLast({ you: text, wendy: reply })
      go('speaking')

      const speakRes = await fetch('/api/wendy/speak', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: reply }),
      })
      if (!speakRes.ok) throw new Error('ElevenLabs error')

      const blob  = await speakRes.blob()
      const url   = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onended = () => { URL.revokeObjectURL(url); startRec() }
      audio.play().catch(() => startRec())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setTimeout(startRec, 2000)
    }
  }

  function begin() {
    const a = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==')
    a.play().catch(() => {})
    startRec()
  }

  const color = PHASE_COLOR[phase]

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '2rem', gap: '2.5rem',
    }}>

      {/* Orb */}
      <div
        onClick={phase === 'init' ? begin : undefined}
        style={{
          width: 120, height: 120, borderRadius: '50%',
          background: `radial-gradient(circle at 40% 35%, ${color}22, transparent 70%)`,
          border: `2px solid ${color}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: phase === 'init' ? 'pointer' : 'default',
          boxShadow: phase === 'listening'
            ? `0 0 40px ${color}33, 0 0 80px ${color}18`
            : phase === 'speaking'
            ? `0 0 50px ${color}44`
            : 'none',
          transition: 'all 0.4s ease',
        }}
      >
        {phase === 'init' ? (
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
            <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>
          </svg>
        ) : (
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"
            style={{ opacity: phase === 'thinking' ? 0.5 : 1, transition: 'opacity 0.3s' }}>
            <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>
          </svg>
        )}
      </div>

      {/* Status */}
      <div style={{ textAlign: 'center' }}>
        <p style={{
          fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.2em',
          textTransform: 'uppercase', color, marginBottom: 8,
        }}>
          {PHASE_LABEL[phase]}
        </p>
        {transcript && (
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', maxWidth: 360, textAlign: 'center', lineHeight: 1.5 }}>
            {transcript}
          </p>
        )}
        {error && (
          <p style={{ fontSize: 12, color: '#f87171', marginTop: 4 }}>{error}</p>
        )}
      </div>

      {/* Last exchange */}
      {last && (
        <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12, padding: '12px 16px',
          }}>
            <p style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#64748b', marginBottom: 6 }}>You</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55 }}>{last.you}</p>
          </div>
          <div style={{
            background: 'rgba(0,180,255,0.04)', border: '1px solid rgba(0,180,255,0.12)',
            borderRadius: 12, padding: '12px 16px',
          }}>
            <p style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#00b4ff', marginBottom: 6 }}>Wendy</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>{last.wendy}</p>
          </div>
        </div>
      )}
    </div>
  )
}
