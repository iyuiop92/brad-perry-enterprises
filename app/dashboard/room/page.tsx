'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// The voice meeting room. Tap once to speak ONE message (never always-listening).
// Address an agent by name to bring them in — "Wendy, ..." / "Ellie, ..." — or
// "team/both" for a relay. The last-addressed agent continues until you name
// someone else. Routing reads ONLY your voice, never the agents' replies, so
// them saying each other's names never mis-fires.

type Agent = 'wendy' | 'ellie'
type Phase = 'idle' | 'listening' | 'thinking' | 'speaking'
type LogEntry = { who: 'brad' | Agent; text: string }
type Msg = { role: 'user' | 'assistant'; content: string }

const AGENT_META: Record<Agent, { label: string; color: string }> = {
  wendy: { label: 'Wendy', color: '#00b4ff' },
  ellie: { label: 'Ellie', color: '#a78bfa' },
}

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'Tap to talk',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
}

// Map the shared meeting log into a per-agent message history. The replying
// agent sees its own lines as assistant turns; Brad and the OTHER agent are
// user turns (the teammate prefixed by name so it knows who spoke).
function historyFor(agent: Agent, log: LogEntry[]): Msg[] {
  return log.slice(-10).map((e) => {
    if (e.who === agent) return { role: 'assistant', content: e.text }
    if (e.who === 'brad') return { role: 'user', content: e.text }
    return { role: 'user', content: `${AGENT_META[e.who as Agent].label} said: ${e.text}` }
  })
}

// Decide who Brad addressed. Returns the agent(s) and the message with the
// leading name stripped. No name -> keep talking to the active agent.
function route(text: string, active: Agent): { agents: Agent[]; cleaned: string } {
  const t = text.trim()
  const lower = t.toLowerCase()
  const strip = (re: RegExp) => t.replace(re, '').trim() || t
  if (/^(hey )?(both|team|everyone|guys|you two)\b[,.: ]*/i.test(lower)) {
    return { agents: ['wendy', 'ellie'], cleaned: strip(/^(hey )?(both|team|everyone|guys|you two)\b[,.: ]*/i) }
  }
  if (/^(hey )?wendy\b[,.: ]*/i.test(lower)) return { agents: ['wendy'], cleaned: strip(/^(hey )?wendy\b[,.: ]*/i) }
  // common speech-to-text hearings of "Ellie"
  if (/^(hey )?(ellie|ally|allie|elly|eli)\b[,.: ]*/i.test(lower)) {
    return { agents: ['ellie'], cleaned: strip(/^(hey )?(ellie|ally|allie|elly|eli)\b[,.: ]*/i) }
  }
  return { agents: [active], cleaned: t }
}

export default function VoiceRoomPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [active, setActive] = useState<Agent>('wendy')
  const [quick, setQuick] = useState(true)
  const [transcript, setTranscript] = useState('')
  const [log, setLog] = useState<LogEntry[]>([])
  const [error, setError] = useState('')

  const logRef = useRef<LogEntry[]>([])
  const activeRef = useRef<Agent>('wendy')
  const recRef = useRef<{ stop: () => void } | null>(null)

  function pushLog(e: LogEntry) {
    logRef.current = [...logRef.current, e]
    setLog(logRef.current)
  }

  async function speak(agent: Agent, text: string) {
    const res = await fetch('/api/room/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, agent }),
    })
    if (!res.ok) return
    const url = URL.createObjectURL(await res.blob())
    await new Promise<void>((resolve) => {
      const audio = new Audio(url)
      audio.onended = () => { URL.revokeObjectURL(url); resolve() }
      audio.onerror = () => { URL.revokeObjectURL(url); resolve() }
      audio.play().catch(() => resolve())
    })
  }

  async function replyFrom(agent: Agent, text: string) {
    const res = await fetch('/api/room/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent, text, history: historyFor(agent, logRef.current) }),
    })
    const data = await res.json()
    const reply: string = data.reply ?? data.error ?? 'Sorry, something went wrong.'
    pushLog({ who: agent, text: reply })
    setPhase('speaking')
    await speak(agent, reply)
  }

  async function handleUtterance(raw: string) {
    setTranscript('')
    const { agents, cleaned } = route(raw, activeRef.current)
    pushLog({ who: 'brad', text: raw })

    // Deep mode: hand off to the heavy terminal agents in the Bridge.
    if (!quick) {
      const target = agents.length > 1 ? 'both' : agents[0] === 'ellie' ? 'codex' : 'claude'
      fetch('/api/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: cleaned, target }),
      }).catch(() => {})
      setPhase('speaking')
      await speak(agents[0], 'Got it. I handed that to the build team. Watch the Bridge for the full answer.')
      setPhase('idle')
      return
    }

    try {
      setPhase('thinking')
      for (const agent of agents) {
        activeRef.current = agent
        setActive(agent)
        await replyFrom(agent, cleaned)
      }
    } catch {
      setError('Something went wrong reaching the team.')
    } finally {
      setPhase('idle') // tap-once: do NOT auto-restart listening
    }
  }

  function startListen() {
    if (phase !== 'idle') return
    // Web Speech API isn't in the TS DOM lib here — access it untyped.
    const w = window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!Ctor) { setError('Voice needs Chrome or Safari.'); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new Ctor() as any
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-US'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const r = e.results[e.results.length - 1]
      setTranscript(r[0].transcript)
      if (r.isFinal) { rec.stop(); handleUtterance(r[0].transcript) }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') setError('Mic error: ' + e.error)
      setPhase('idle')
    }
    rec.onend = () => setPhase((p) => (p === 'listening' ? 'idle' : p))
    recRef.current = { stop: () => { try { rec.stop() } catch {} } }
    try { rec.start(); setError(''); setTranscript(''); setPhase('listening') } catch {}
  }

  function stopAll() {
    recRef.current?.stop()
    setPhase('idle')
  }

  const orbColor = phase === 'idle' ? '#64748b' : AGENT_META[active].color
  const busy = phase === 'thinking' || phase === 'speaking'

  return (
    <div style={{ background: '#04040a', minHeight: '100dvh', display: 'flex', flexDirection: 'column', paddingTop: 'calc(3.25rem + env(safe-area-inset-top))' }}>
      {/* Close */}
      <button
        onClick={() => router.push('/dashboard')}
        aria-label="Close"
        style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top) + 8px)', right: 12, width: 44, height: 44, borderRadius: 10, background: 'rgba(13,13,26,0.92)', border: '1px solid rgba(0,180,255,0.28)', color: '#e2e8f0', cursor: 'pointer', zIndex: 50 }}
      >✕</button>

      <div style={{ maxWidth: 640, width: '100%', margin: '0 auto', padding: '0 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header style={{ padding: '8px 0 4px' }}>
          <p style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#64748b' }}>Team Voice Room</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-outfit)' }}>Talk to Wendy &amp; Ellie</h1>
          <p style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
            Tap to talk. Say a name to bring someone in — &ldquo;Wendy…&rdquo;, &ldquo;Ellie…&rdquo;, or &ldquo;team…&rdquo;.
          </p>
        </header>

        {/* Quick / Deep toggle — subtle tap, like the timers */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '10px 0' }}>
          <button onClick={() => setQuick(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: quick ? '#00b4ff' : '#475569' }}>
            Quick
          </button>
          <button onClick={() => setQuick(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: !quick ? '#f59e0b' : '#475569' }}>
            Deep
          </button>
          <span style={{ fontSize: 11, color: '#334155' }}>
            {quick ? 'Fast replies, spoken here.' : 'Heavy build agents — lands in the Bridge.'}
          </span>
        </div>

        {/* Orb */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '18px 0' }}>
          <button
            onClick={phase === 'idle' ? startListen : stopAll}
            style={{
              width: 132, height: 132, borderRadius: '50%', cursor: 'pointer',
              background: `radial-gradient(circle at 40% 35%, ${orbColor}22, transparent 70%)`,
              border: `2px solid ${orbColor}66`,
              boxShadow: phase === 'listening' ? `0 0 44px ${orbColor}44` : phase === 'speaking' ? `0 0 52px ${orbColor}55` : 'none',
              color: orbColor, fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              transition: 'all 0.35s ease',
            }}
          >
            {phase === 'listening' ? 'Stop' : busy ? '' : 'Talk'}
          </button>
          <p style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: orbColor }}>
            {phase === 'idle' ? PHASE_LABEL.idle : `${AGENT_META[active].label} · ${PHASE_LABEL[phase]}`}
          </p>
          {transcript && <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center', maxWidth: 400 }}>{transcript}</p>}
          {error && <p style={{ fontSize: 12, color: '#f87171' }}>{error}</p>}
        </div>

        {/* Transcript log */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 24 }}>
          {log.slice(-12).map((e, i) => {
            const isBrad = e.who === 'brad'
            const color = isBrad ? '#94a3b8' : AGENT_META[e.who as Agent].color
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isBrad ? 'flex-end' : 'flex-start' }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color, marginBottom: 3 }}>
                  {isBrad ? 'You' : AGENT_META[e.who as Agent].label}
                </span>
                <div style={{ maxWidth: '86%', borderRadius: 10, padding: '9px 13px', fontSize: 14, lineHeight: 1.5, background: isBrad ? 'rgba(148,163,184,0.08)' : `${color}12`, border: `1px solid ${isBrad ? 'rgba(148,163,184,0.16)' : color + '2b'}`, color: '#e2e8f0' }}>
                  {e.text}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
