'use client'

import { useEffect, useRef, useState } from 'react'
import { ImageAttachmentPicker, type PendingImage } from './ImageAttachmentPicker'

type Agent = 'wendy' | 'ellie'
type Phase = 'idle' | 'listening' | 'thinking' | 'speaking'
type LogEntry = { who: 'brad' | Agent; text: string }
type BridgeMessage = { id: string; role: 'user' | 'claude' | 'codex' | 'system'; target: string | null; content: string; status: string; created_at: string }

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

function isMobileVoiceLayout() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
}

export default function DashboardVoiceDock() {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [active, setActive] = useState<Agent>('wendy')
  const [deepPending, setDeepPending] = useState(false)
  const [queuedCount, setQueuedCount] = useState(0)
  const [typedMessage, setTypedMessage] = useState('')
  const [images, setImages] = useState<PendingImage[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [error, setError] = useState('')
  const logRef = useRef<LogEntry[]>([])
  const phaseRef = useRef<Phase>('idle')
  const activeRef = useRef<Agent>('wendy')
  const recRef = useRef<{ stop: () => void } | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const messageInputRef = useRef<HTMLInputElement | null>(null)
  const spokenTextRef = useRef('')
  const silenceTimerRef = useRef<number | null>(null)
  const manualSpeechStopRef = useRef(false)
  const deepPendingRef = useRef(false)
  const queueRef = useRef<{ text: string; attachments: PendingImage[] }[]>([])

  useEffect(() => { deepPendingRef.current = deepPending }, [deepPending])
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => () => {
    recRef.current?.stop()
    audioRef.current?.pause()
    audioSourceRef.current?.stop()
    if (silenceTimerRef.current !== null) window.clearTimeout(silenceTimerRef.current)
    void audioContextRef.current?.close()
  }, [])

  const push = (entry: LogEntry) => {
    logRef.current = [...logRef.current, entry].slice(-16)
    setLog(logRef.current)
  }

  const unlockAudio = () => {
    const browser = window as typeof window & { webkitAudioContext?: typeof AudioContext }
    const AudioContextConstructor = browser.AudioContext ?? browser.webkitAudioContext
    if (!AudioContextConstructor) return
    if (!audioContextRef.current) audioContextRef.current = new AudioContextConstructor()
    const context = audioContextRef.current
    const prime = () => {
      try {
        const source = context.createOscillator()
        const gain = context.createGain()
        gain.gain.value = 0.00001
        source.connect(gain)
        gain.connect(context.destination)
        source.start()
        source.stop(context.currentTime + 0.02)
      } catch {}
    }
    // This is called directly from the Talk/send tap. Priming the context here
    // keeps iOS' audio session authorized for the asynchronous reply later.
    if (context.state === 'suspended') void context.resume().then(prime).catch(() => {})
    else prime()
  }

  const playWithAudioContext = async (bytes: ArrayBuffer) => {
    const context = audioContextRef.current
    if (!context) return false
    try {
      if (context.state === 'suspended') await context.resume()
      if (context.state !== 'running') return false
      const buffer = await context.decodeAudioData(bytes.slice(0))
      await new Promise<void>((resolve) => {
        const source = context.createBufferSource()
        source.buffer = buffer
        source.connect(context.destination)
        source.onended = () => { if (audioSourceRef.current === source) audioSourceRef.current = null; resolve() }
        audioSourceRef.current = source
        source.start()
      })
      return true
    } catch {
      return false
    }
  }

  const playWithAudioElement = async (bytes: ArrayBuffer) => {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }))
    await new Promise<void>((resolve, reject) => {
      const audio = new Audio(url)
      let settled = false
      const finish = (cause?: Error) => {
        if (settled) return
        settled = true
        URL.revokeObjectURL(url)
        if (audioRef.current === audio) audioRef.current = null
        if (cause) reject(cause)
        else resolve()
      }

      // iOS Safari is more reliable with an HTML media element than decoding a
      // response in Web Audio after the microphone has been used.
      audio.preload = 'auto'
      audio.setAttribute('playsinline', '')
      audio.muted = false
      audio.volume = 1
      audioRef.current = audio
      audio.onended = () => finish()
      audio.onerror = () => finish(new Error('Voice playback could not start. Turn off Silent Mode, raise the media volume, then tap Talk again.'))
      void audio.play().catch(() => finish(new Error('Voice playback was blocked. Turn off Silent Mode, raise the media volume, then tap Talk again.')))
    })
  }

  const speak = async (agent: Agent, text: string) => {
    const response = await fetch('/api/room/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent, text }) })
    if (!response.ok) throw new Error('Speech was unavailable.')
    const bytes = await response.arrayBuffer()
    // AudioContext is primed during the user gesture, so it remains permitted
    // after transcription and the teammate reply finish on iPhone.
    if (await playWithAudioContext(bytes)) return

    await playWithAudioElement(bytes)
  }

  // Deep path: drive the real terminal agent through the Bridge. Post the
  // utterance, then poll for that agent's assistant reply (can take minutes).
  const deepReply = async (agent: Agent, text: string, attachments: PendingImage[] = []): Promise<string> => {
    const target = BRIDGE_TARGET[agent]
    const post = await fetch('/api/bridge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text, target, attachments: attachments.map(({ filename, mediaType, url }) => ({ filename, mime: mediaType, data_url: url })) }) })
    const posted = await post.json()
    if (!post.ok || posted?.error) throw new Error(posted?.error || 'Bridge did not accept the request.')
    const since = String(posted.created_at)

    const deadline = Date.now() + 6 * 60 * 1000 // stop waiting after 6 minutes
    while (Date.now() < deadline) {
      await new Promise(resolve => window.setTimeout(resolve, 3000))
      const res = await fetch(`/api/bridge?since=${encodeURIComponent(since)}`)
      if (!res.ok) continue
      const rows = (await res.json()) as BridgeMessage[]
      // Bridge worker replies use the agent role (`claude` or `codex`) and do
      // not copy the target column from Brad's queued message.
      const reply = rows.find(row => row.role === target && row.content?.trim())
      if (reply) return reply.content.trim()
    }
    throw new Error('The real agent did not reply in time.')
  }

  // Run one utterance against the real bridge, then drain any messages Brad
  // queued while it was working — answered in the order he sent them.
  const runUtterance = async (raw: string, attachments: PendingImage[]) => {
    const target = route(raw, activeRef.current)
    try {
      for (const agent of target.agents) {
        activeRef.current = agent
        setActive(agent)
        const reply = await deepReply(agent, target.text, attachments)
        push({ who: agent, text: reply })
        setPhase('speaking')
        await speak(agent, reply)
      }
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'The real agent could not be reached.')
    } finally {
      const next = queueRef.current.shift()
      setQueuedCount(queueRef.current.length)
      if (next) {
        setPhase('thinking')
        void runUtterance(next.text, next.attachments)
      } else {
        setDeepPending(false)
        setPhase('idle')
      }
    }
  }

  const handleUtterance = async (raw: string, attachments: PendingImage[] = []) => {
    push({ who: 'brad', text: raw })
    // If a turn is already running, line this one up instead of dropping it.
    // Every request goes to the real bridge, so the dashboard and Telegram use
    // the same capable agents.
    if (deepPendingRef.current) {
      queueRef.current.push({ text: raw, attachments })
      setQueuedCount(queueRef.current.length)
      return
    }
    setDeepPending(true)
    void runUtterance(raw, attachments)
  }

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
  }

  const finishDesktopSpeech = () => {
    clearSilenceTimer()
    const text = spokenTextRef.current.trim()
    spokenTextRef.current = ''
    manualSpeechStopRef.current = true
    recRef.current?.stop()
    recRef.current = null
    if (text) {
      setPhase('thinking')
      void handleUtterance(text)
    }
    else setPhase('idle')
  }

  const armSilenceTimer = () => {
    clearSilenceTimer()
    silenceTimerRef.current = window.setTimeout(finishDesktopSpeech, 10_000)
  }

  const startListening = () => {
    if (phase !== 'idle') return
    const browser = window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }
    const Recognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition
    if (!Recognition) { setError('Voice requires Chrome or Safari.'); return }
    const recognition = new Recognition() as any
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1]
      if (!result.isFinal) return
      const finalText = Array.from(event.results)
        .slice(event.resultIndex)
        .filter((item: any) => item.isFinal)
        .map((item: any) => item[0].transcript)
        .join(' ')
        .trim()
      if (!finalText) return
      spokenTextRef.current = `${spokenTextRef.current} ${finalText}`.trim()
      armSilenceTimer()
    }
    recognition.onerror = (event: any) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setError(event.error === 'audio-capture'
          ? 'Voice input is unavailable on this phone. Type below and the team will still reply aloud.'
          : `Mic error: ${event.error}`)
      }
      recRef.current = null
      clearSilenceTimer()
      setPhase('idle')
    }
    recognition.onend = () => {
      recRef.current = null
      if (manualSpeechStopRef.current) { manualSpeechStopRef.current = false; return }
      if (phaseRef.current === 'listening') {
        window.setTimeout(() => {
          try {
            if (phaseRef.current === 'listening') {
              recRef.current = { stop: () => { try { recognition.stop() } catch {} } }
              recognition.start()
            }
          } catch {}
        }, 150)
      }
    }
    recRef.current = { stop: () => { try { recognition.stop() } catch {} } }
    try {
      spokenTextRef.current = ''
      clearSilenceTimer()
      recognition.start()
      setError('')
      setPhase('listening')
    } catch {}
  }

  const transcribeMobileRecording = async (blob: Blob) => {
    setPhase('thinking')
    const form = new FormData()
    form.set('audio', blob, `voice-message.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`)
    const response = await fetch('/api/room/transcribe', { method: 'POST', body: form })
    const data = await response.json()
    if (!response.ok || !data.text) throw new Error(data.error || 'Could not transcribe that recording.')
    await handleUtterance(String(data.text))
  }

  const startMobileRecording = async () => {
    if (phase !== 'idle') return
    unlockAudio()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks: BlobPart[] = []
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      recorder.onerror = () => { setError('Could not record your voice. Please try again.'); setPhase('idle') }
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop())
        recRef.current = null
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        if (!blob.size) { setError('No audio was captured. Please try again.'); setPhase('idle'); return }
        void transcribeMobileRecording(blob).catch(cause => {
          setError(cause instanceof Error ? cause.message : 'Could not transcribe that recording.')
          setPhase('idle')
        })
      }
      recRef.current = { stop: () => { if (recorder.state !== 'inactive') recorder.stop() } }
      recorder.start()
      setError('')
      setPhase('listening')
    } catch {
      setError('Microphone access is unavailable. You can type your message below.')
      setPhase('idle')
    }
  }

  const interrupt = () => {
    audioRef.current?.pause()
    audioRef.current = null
    audioSourceRef.current?.stop()
    audioSourceRef.current = null
    setPhase('idle')
  }
  const talk = () => {
    setOpen(true)
    if (isMobileVoiceLayout()) {
      if (phase === 'listening') { recRef.current?.stop(); return }
      if (phase === 'thinking' || phase === 'speaking') { interrupt(); return }
      void startMobileRecording()
      return
    }
    if (phase === 'thinking' || phase === 'speaking') { interrupt(); return }
    if (phase === 'listening') { finishDesktopSpeech(); return }
    startListening()
  }
  const sendTypedMessage = () => {
    const text = typedMessage.trim()
    // No deepPending guard: sending while a turn is running queues the message
    // so it is answered next, in order, instead of being dropped.
    if (!text && images.length === 0) return
    setTypedMessage('')
    const attachments = images
    setImages([])
    setError('')
    unlockAudio()
    void handleUtterance(text || 'I attached a photo for context.', attachments)
  }
  const label = deepPending
    ? queuedCount > 0
      ? `The real agent is working. ${queuedCount} message${queuedCount === 1 ? '' : 's'} queued, answered in order.`
      : 'The real agent is working. This can take a minute. Send another and it will queue.'
    : phase === 'listening' ? 'Listening — pause when you are done'
    : phase === 'thinking' ? 'Thinking…'
    : phase === 'speaking' ? `${META[active].label} is speaking`
    : 'Ready'
  const voiceControls = () => <>
    <button
      className="dashboard-voice-control"
      onClick={talk}
      disabled={false}
      aria-label={phase === 'speaking' ? 'Interrupt' : phase === 'listening' ? 'Stop listening' : phase === 'thinking' ? 'Cancel' : 'Talk to Wendy'}
      style={{
        ...headerButtonStyle(phase === 'listening' ? '#f87171' : (phase === 'speaking' || phase === 'thinking') ? '#facc15' : '#00b4ff'),
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '0 8px',
        border: `1px solid ${phase === 'listening' ? 'rgba(248,113,113,0.35)' : 'rgba(0,180,255,0.25)'}`,
        borderRadius: 8,
        background: phase === 'listening' ? 'rgba(248,113,113,0.08)' : 'rgba(0,180,255,0.06)',
        height: 28,
      }}
    >
      {phase === 'listening' ? (
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f87171', animation: 'pulse 1s ease-in-out infinite' }} aria-hidden />
      ) : phase === 'speaking' ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
        </svg>
      ) : phase === 'thinking' ? (
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#facc15', animation: 'pulse 1s ease-in-out infinite' }} aria-hidden />
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      )}
      {phase === 'speaking' ? 'Stop' : phase === 'listening' ? 'Listening' : phase === 'thinking' ? 'Cancel' : 'Talk'}
    </button>
  </>

  return <>
    <style>{`@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.25 } }`}</style>
    <div className="dashboard-voice-header">
      <div className="dashboard-voice-desktop" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {voiceControls()}
      </div>
      <details className="dashboard-voice-mobile-menu">
        <summary style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          Talk
        </summary>
        <div className="dashboard-voice-mobile-menu-panel">
          {voiceControls()}
        </div>
      </details>
    </div>
    {/* Big mic FAB — center-bottom, visible the moment you land, one tap to talk */}
    {!open && (
      <button
        onClick={talk}
        aria-label="Talk to Wendy"
        style={{
          position: 'fixed',
          bottom: 'calc(32px + env(safe-area-inset-bottom))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 115,
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: '#00b4ff',
          border: 'none',
          boxShadow: '0 4px 32px rgba(0,180,255,0.55)',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#04040a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        <span style={{ fontSize: 8, fontWeight: 800, color: '#04040a', letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1 }}>Talk</span>
      </button>
    )}
    {open && <>
      <aside className="dashboard-voice-panel" style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(18px + env(safe-area-inset-bottom))', zIndex: 116, width: 'auto', maxWidth: 540, marginLeft: 'auto', boxSizing: 'border-box', overflowY: 'auto', background: '#0a0a12', border: '1px solid rgba(0,180,255,0.35)', borderRadius: 10, padding: 14, boxShadow: '0 22px 70px rgba(0,0,0,0.56)', display: 'grid', gap: 12 }}>
      <div className="dashboard-voice-panel-heading" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><div><strong style={{ color: '#f8fafc', fontSize: 14 }}>Command Room</strong><p style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>Say “Wendy,” “Ellie,” or “Team.” Every request goes to the real agent.</p></div><button aria-label="Close Command Room" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button></div>
      <p style={{ color: deepPending ? '#00b4ff' : '#94a3b8', fontSize: 12, margin: 0 }}>
        {deepPending && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 10, background: '#00b4ff', marginRight: 6, animation: 'pulse 1.2s ease-in-out infinite' }} />}
        {label}
      </p>
      <div className="dashboard-voice-composer" style={{ display: 'flex', gap: 8 }}>
        <ImageAttachmentPicker images={images} onChange={setImages} disabled={false} color="#a78bfa" />
        <input
          ref={messageInputRef}
          aria-label="Message the team"
          value={typedMessage}
          onChange={event => setTypedMessage(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendTypedMessage() } }}
          placeholder="Ask Wendy, Ellie, or Team…"
          style={{ flex: 1, minWidth: 0, height: 34, border: '1px solid rgba(167,139,250,0.28)', borderRadius: 8, background: '#10111a', color: '#e2e8f0', padding: '0 10px', fontSize: 13, outline: 'none' }}
        />
        <button onClick={sendTypedMessage} disabled={!typedMessage.trim() && images.length === 0} style={{ border: 0, borderRadius: 8, background: '#a78bfa', color: '#0a0a12', padding: '0 11px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
          {deepPending ? 'Queue' : 'Send'}
        </button>
      </div>
      {log.length > 0 && <div className="dashboard-voice-transcript" style={{ display: 'grid', gap: 7, maxHeight: 300, overflowY: 'auto' }}>{log.map((entry, index) => <div key={index} style={{ background: '#10111a', color: entry.who === 'brad' ? '#cbd5e1' : META[entry.who].color, borderRadius: 7, padding: '8px 9px', fontSize: 12, lineHeight: 1.45 }}>{entry.text}</div>)}</div>}
      {error && <p style={{ color: '#f87171', fontSize: 12 }}>{error}</p>}
    </aside>
    </>}
  </>
}

function headerButtonStyle(color: string) { return { height: 28, padding: '0 6px', border: 'none', background: 'transparent', color, cursor: 'pointer', fontSize: 10, fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap' as const } }
