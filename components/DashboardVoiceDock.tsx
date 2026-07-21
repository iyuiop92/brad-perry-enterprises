'use client'

import { useEffect, useRef, useState } from 'react'

type Agent = 'wendy' | 'ellie'
type Mode = 'quick' | 'deep'
type Phase = 'idle' | 'listening' | 'thinking' | 'speaking'
type LogEntry = { who: 'brad' | Agent; text: string }
type Msg = { role: 'user' | 'assistant'; content: string }
type BridgeMessage = { id: string; role: string; target: string; content: string; status: string; created_at: string }

// Map a voice agent to its terminal-agent Bridge target.
const BRIDGE_TARGET: Record<Agent, 'claude' | 'codex'> = { wendy: 'claude', ellie: 'codex' }

const META: Record<Agent, { label: string; color: string }> = {
  wendy: { label: 'Wendy', color: '#00b4ff' },
  ellie: { label: 'Ellie', color: '#a78bfa' },
}

function route(text: string, active: Agent) {
  const clean = (re: RegExp) => text.replace(re, '').trim() || text
  if (/^(hey )?(both|team|everyone|you two)\b[,.: ]*/i.test(text)) return { agents: ['wendy', 'ellie'] as Agent[], text: clean(/^(hey )?(both|team|everyone|you two)\b[,.: ]*/i) }
  if (/^(hey )?wendy\b[,.: ]*/i.test(text)) return { agents: ['wendy'] as Agent[], text: clean(/^(hey )?wendy\b[,.: ]*/i) }
  if (/^(hey )?(ellie|ally|allie|elly|eli)\b[,.: ]*/i.test(text)) return { agents: ['ellie'] as Agent[], text: clean(/^(hey )?(ellie|ally|allie|elly|eli)\b[,.: ]*/i) }
  return { agents: [active], text }
}

function asksForText(text: string) {
  return /\b(show|read|open)\b.{0,48}\b(text|transcript|instructions|meaning)\b|show me what you mean|what did you (just )?say/i.test(text)
}

function historyFor(agent: Agent, log: LogEntry[]): Msg[] {
  return log.slice(-10).map(entry => entry.who === agent
    ? { role: 'assistant', content: entry.text }
    : { role: 'user', content: entry.who === 'brad' ? entry.text : `${META[entry.who].label} said: ${entry.text}` })
}

export default function DashboardVoiceDock({ context }: { context: string }) {
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [active, setActive] = useState<Agent>('wendy')
  const [mode, setMode] = useState<Mode>('quick')
  const [deepPending, setDeepPending] = useState(false)
  const [locked, setLocked] = useState(false)
  const [showText, setShowText] = useState(false)
  const [log, setLog] = useState<LogEntry[]>([])
  const [error, setError] = useState('')
  const logRef = useRef<LogEntry[]>([])
  const activeRef = useRef<Agent>('wendy')
  const modeRef = useRef<Mode>('quick')
  const lockedRef = useRef(false)
  const recRef = useRef<{ stop: () => void } | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const startRef = useRef<() => void>(() => {})

  useEffect(() => { lockedRef.current = locked }, [locked])
  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => () => { recRef.current?.stop(); audioRef.current?.pause() }, [])

  const push = (entry: LogEntry) => {
    logRef.current = [...logRef.current, entry].slice(-16)
    setLog(logRef.current)
  }

  const speak = async (agent: Agent, text: string) => {
    const response = await fetch('/api/room/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent, text }) })
    if (!response.ok) throw new Error('Speech was unavailable.')
    const url = URL.createObjectURL(await response.blob())
    await new Promise<void>((resolve) => {
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; resolve() }
      audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; resolve() }
      audio.play().catch(resolve)
    })
  }

  // Deep path: drive the real terminal agent through the Bridge. Post the
  // utterance, then poll for that agent's assistant reply (can take minutes).
  const deepReply = async (agent: Agent, text: string): Promise<string> => {
    const target = BRIDGE_TARGET[agent]
    const post = await fetch('/api/bridge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text, target }) })
    const posted = await post.json()
    if (!post.ok || posted?.error) throw new Error(posted?.error || 'Bridge did not accept the request.')
    const since = String(posted.created_at)

    const deadline = Date.now() + 6 * 60 * 1000 // stop waiting after 6 minutes
    while (Date.now() < deadline) {
      await new Promise(resolve => window.setTimeout(resolve, 3000))
      const res = await fetch(`/api/bridge?since=${encodeURIComponent(since)}`)
      if (!res.ok) continue
      const rows = (await res.json()) as BridgeMessage[]
      const reply = rows.find(row => row.role === 'assistant' && row.target === target && row.content?.trim())
      if (reply) return reply.content.trim()
    }
    throw new Error('The real agent did not reply in time.')
  }

  const handleUtterance = async (raw: string) => {
    const target = route(raw, activeRef.current)
    if (asksForText(raw)) setShowText(true)
    push({ who: 'brad', text: raw })

    if (modeRef.current === 'deep') {
      // Deep replies are slow. Run detached so Quick input is never blocked.
      setDeepPending(true)
      void (async () => {
        try {
          for (const agent of target.agents) {
            const reply = await deepReply(agent, target.text)
            push({ who: agent, text: reply })
            await speak(agent, reply)
          }
        } catch (cause: unknown) {
          setError(cause instanceof Error ? cause.message : 'The real agent could not be reached.')
        } finally {
          setDeepPending(false)
        }
      })()
      return
    }

    try {
      setPhase('thinking')
      for (const agent of target.agents) {
        activeRef.current = agent
        setActive(agent)
        const response = await fetch('/api/room/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent, text: target.text, history: historyFor(agent, logRef.current) }) })
        const data = await response.json()
        if (!response.ok || data.error) throw new Error(data.error || 'Partner did not respond.')
        const reply = String(data.reply || '')
        push({ who: agent, text: reply })
        setPhase('speaking')
        await speak(agent, reply)
      }
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Could not reach the team.')
    } finally {
      setPhase('idle')
      if (lockedRef.current) window.setTimeout(() => startRef.current(), 250)
    }
  }

  const startListening = () => {
    if (phase !== 'idle') return
    const browser = window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }
    const Recognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition
    if (!Recognition) { setError('Voice requires Chrome or Safari.'); return }
    const recognition = new Recognition() as any
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.onresult = (event: any) => { const result = event.results[event.results.length - 1]; if (result.isFinal) { recognition.stop(); void handleUtterance(result[0].transcript) } }
    recognition.onerror = (event: any) => { if (event.error !== 'aborted' && event.error !== 'no-speech') setError(`Mic error: ${event.error}`); setPhase('idle') }
    recognition.onend = () => setPhase(current => current === 'listening' ? 'idle' : current)
    recRef.current = { stop: () => { try { recognition.stop() } catch {} } }
    try { recognition.start(); setError(''); setPhase('listening') } catch {}
  }
  startRef.current = startListening

  const interrupt = () => { audioRef.current?.pause(); audioRef.current = null; setPhase('idle'); window.setTimeout(startListening, 0) }
  const talk = () => {
    setOpen(true)
    if (phase === 'speaking') { interrupt(); return }
    if (phase === 'listening') { recRef.current?.stop(); return }
    startListening()
  }
  const toggleLock = () => { const next = !locked; setLocked(next); setOpen(true); if (next && phase === 'idle') startListening(); if (!next && phase === 'listening') recRef.current?.stop() }
  const goDeeper = () => { setOpen(true); setFocused(value => !value) }
  const label = deepPending
    ? 'The real agent is working. This can take a minute. Keep talking if you want.'
    : phase === 'listening' ? 'Listening — pause when you are done'
    : phase === 'thinking' ? 'Thinking…'
    : phase === 'speaking' ? `${META[active].label} is speaking`
    : 'Ready'

  return <>
    <style>{`@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.25 } }`}</style>
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <button onClick={talk} disabled={phase === 'thinking'} style={headerButtonStyle(phase === 'listening' ? '#f87171' : '#a78bfa')}>
        {phase === 'speaking' ? 'Interrupt' : phase === 'listening' ? 'Stop' : 'Talk'}
      </button>
      <button onClick={toggleLock} style={headerButtonStyle(locked ? '#c4b5fd' : '#94a3b8')}>
        {locked ? 'Unlock talk' : 'Lock talk'}
      </button>
      <button onClick={goDeeper} style={headerButtonStyle('#a78bfa')}>
        {focused ? 'Compact' : 'Go deeper'}
      </button>
      {deepPending && <button onClick={() => { setOpen(true); setFocused(true) }} style={headerButtonStyle('#00b4ff')}>
        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 10, background: '#00b4ff', marginRight: 5, animation: 'pulse 1.2s ease-in-out infinite' }} />Agent working
      </button>}
    </div>
    {open && <>
      {focused && <div onClick={() => { setOpen(false); setFocused(false) }} style={{ position: 'fixed', inset: 0, zIndex: 114, background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(3px)' }} />}
      <aside style={focused
        ? { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 116, width: 'min(680px, calc(100vw - 48px))', maxHeight: 'calc(100vh - 96px)', overflowY: 'auto', background: '#0a0a12', border: '1px solid rgba(167,139,250,0.42)', borderRadius: 10, padding: 18, boxShadow: '0 30px 90px rgba(0,0,0,0.7)', display: 'grid', gap: 12 }
        : { position: 'fixed', right: 18, bottom: 18, zIndex: 116, width: 'min(370px, calc(100vw - 36px))', overflowY: 'auto', background: '#0a0a12', border: '1px solid rgba(167,139,250,0.42)', borderRadius: 10, padding: 14, boxShadow: '0 22px 70px rgba(0,0,0,0.56)', display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><div><strong style={{ color: '#f8fafc', fontSize: 14 }}>Dashboard conversation</strong><p style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>{focused ? 'Focused voice space — your dashboard remains behind it.' : 'Talk about the work while the board stays visible.'}</p></div><button aria-label="Close voice conversation" onClick={() => { setOpen(false); setFocused(false) }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#64748b', fontSize: 11 }}>Mode</span>
        <button onClick={() => setMode('quick')} style={togglePillStyle(mode === 'quick')}>Quick</button>
        <button onClick={() => setMode('deep')} style={togglePillStyle(mode === 'deep')}>Deep</button>
        <span style={{ color: '#475569', fontSize: 10 }}>{mode === 'deep' ? 'real terminal agent, slow' : 'fast voice reply'}</span>
      </div>
      <p style={{ color: deepPending ? '#00b4ff' : '#94a3b8', fontSize: 12, margin: 0 }}>
        {deepPending && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 10, background: '#00b4ff', marginRight: 6, animation: 'pulse 1.2s ease-in-out infinite' }} />}
        {label}
      </p>
      {showText && <div style={{ display: 'flex', gap: 8 }}><button onClick={() => setShowText(false)} style={buttonStyle('#94a3b8')}>Hide text</button></div>}
      {(showText || focused) && (log.length > 0
        ? <div style={{ display: 'grid', gap: 7, maxHeight: focused ? 360 : 220, overflowY: 'auto' }}>{log.map((entry, index) => <div key={index} style={{ background: '#10111a', color: entry.who === 'brad' ? '#cbd5e1' : META[entry.who].color, borderRadius: 7, padding: '8px 9px', fontSize: 12, lineHeight: 1.45 }}>{entry.text}</div>)}</div>
        : focused ? <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>Say something to start. I have your dashboard context loaded.</p> : null)}
      {error && <p style={{ color: '#f87171', fontSize: 12 }}>{error}</p>}
    </aside>
    </>}
  </>
}

function buttonStyle(color: string) { return { border: 'none', background: 'transparent', color, padding: '6px 6px', minHeight: 28, cursor: 'pointer', fontSize: 11, fontWeight: 700 } }
function headerButtonStyle(color: string) { return { height: 28, padding: '0 6px', border: 'none', background: 'transparent', color, cursor: 'pointer', fontSize: 10, fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap' as const } }
function togglePillStyle(on: boolean) { const color = on ? '#00b4ff' : '#64748b'; return { height: 24, padding: '0 10px', border: `1px solid ${color}${on ? '99' : '44'}`, background: on ? '#00b4ff22' : 'transparent', color, borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap' as const } }
