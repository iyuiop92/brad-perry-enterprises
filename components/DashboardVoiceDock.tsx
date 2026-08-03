'use client'

import { useEffect, useRef, useState } from 'react'
import { ImageAttachmentPicker, type PendingImage } from './ImageAttachmentPicker'

type Agent = 'wendy' | 'ellie'
type Mode = 'quick' | 'deep'
type Phase = 'idle' | 'listening' | 'thinking' | 'speaking'
type LogEntry = { who: 'brad' | Agent; text: string }
type Msg = { role: 'user' | 'assistant'; content: string }
type BridgeMessage = { id: string; role: 'user' | 'claude' | 'codex' | 'system'; target: string | null; content: string; status: string; created_at: string }

// Map a voice agent to its terminal-agent Bridge target.
const BRIDGE_TARGET: Record<Agent, 'claude' | 'codex'> = { wendy: 'claude', ellie: 'codex' }

const META: Record<Agent, { label: string; color: string }> = {
  wendy: { label: 'Wendy', color: '#00b4ff' },
  ellie: { label: 'Ellie', color: '#a78bfa' },
}

function route(text: string, active: Agent, includeBoth: boolean) {
  const clean = (re: RegExp) => text.replace(re, '').trim() || text
  if (/^(hey )?(both|team|everyone|you two)\b[,.: ]*/i.test(text)) return { agents: ['wendy', 'ellie'] as Agent[], text: clean(/^(hey )?(both|team|everyone|you two)\b[,.: ]*/i) }
  if (/^(hey )?wendy\b[,.: ]*/i.test(text)) return { agents: ['wendy'] as Agent[], text: clean(/^(hey )?wendy\b[,.: ]*/i) }
  if (/^(hey )?(ellie|ally|allie|elly|eli)\b[,.: ]*/i.test(text)) return { agents: ['ellie'] as Agent[], text: clean(/^(hey )?(ellie|ally|allie|elly|eli)\b[,.: ]*/i) }
  return { agents: includeBoth ? ['wendy', 'ellie'] as Agent[] : [active], text }
}

function asksForText(text: string) {
  return /\b(show|read|open)\b.{0,48}\b(text|transcript|instructions|meaning)\b|show me what you mean|what did you (just )?say/i.test(text)
}

function isMobileVoiceLayout() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
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
  const [both, setBoth] = useState(false)
  const [showText, setShowText] = useState(false)
  const [typedMessage, setTypedMessage] = useState('')
  const [images, setImages] = useState<PendingImage[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [error, setError] = useState('')
  const logRef = useRef<LogEntry[]>([])
  const phaseRef = useRef<Phase>('idle')
  const activeRef = useRef<Agent>('wendy')
  const modeRef = useRef<Mode>('quick')
  const lockedRef = useRef(false)
  const bothRef = useRef(false)
  const recRef = useRef<{ stop: () => void } | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const messageInputRef = useRef<HTMLInputElement | null>(null)
  const spokenTextRef = useRef('')
  const silenceTimerRef = useRef<number | null>(null)
  const manualSpeechStopRef = useRef(false)

  useEffect(() => { lockedRef.current = locked }, [locked])
  useEffect(() => { bothRef.current = both }, [both])
  useEffect(() => { modeRef.current = mode }, [mode])
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
    // Guard against overlapping voices: stop anything still playing before we
    // start a new reply. Sequential replies (e.g. Both mode) still play one
    // after another because each speak() call is awaited to completion first;
    // this only kills a second stream that would otherwise talk over the first.
    try { audioRef.current?.pause() } catch {}
    audioRef.current = null
    try { audioSourceRef.current?.stop() } catch {}
    audioSourceRef.current = null

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

  const handleUtterance = async (raw: string, attachments: PendingImage[] = []) => {
    const target = route(raw, activeRef.current, bothRef.current)
    if (asksForText(raw)) setShowText(true)
    push({ who: 'brad', text: raw })

    if (modeRef.current === 'deep') {
      // Deep replies are slow. Run detached so Quick input is never blocked.
      setDeepPending(true)
      void (async () => {
        try {
          for (const agent of target.agents) {
            const reply = await deepReply(agent, target.text, attachments)
            push({ who: agent, text: reply })
            await speak(agent, reply)
          }
        } catch (cause: unknown) {
          setError(cause instanceof Error ? cause.message : 'The real agent could not be reached.')
        } finally {
          setDeepPending(false)
          setPhase('idle')
        }
      })()
      return
    }

    try {
      setPhase('thinking')
      for (const agent of target.agents) {
        activeRef.current = agent
        setActive(agent)
        const response = await fetch('/api/room/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent, text: target.text, history: historyFor(agent, logRef.current), attachments: attachments.map(({ filename, mediaType, url }) => ({ filename, mediaType, url })) }) })
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
      if (lockedRef.current && !isMobileVoiceLayout()) window.setTimeout(startListening, 250)
    }
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
      if (phase === 'speaking') { interrupt(); return }
      void startMobileRecording()
      return
    }
    if (phase === 'speaking') { interrupt(); return }
    if (phase === 'listening') { finishDesktopSpeech(); return }
    startListening()
  }
  const toggleLock = () => {
    const next = !locked
    setLocked(next)
    setOpen(true)
    if (next && phase === 'idle' && !isMobileVoiceLayout()) startListening()
    if (!next && phase === 'listening') recRef.current?.stop()
  }
  const toggleBoth = () => { setBoth(value => !value); setOpen(true) }
  const goDeeper = () => { setOpen(true); setFocused(value => !value) }
  const sendTypedMessage = () => {
    const text = typedMessage.trim()
    if ((!text && images.length === 0) || phase === 'thinking' || deepPending) return
    setTypedMessage('')
    const attachments = images
    setImages([])
    setError('')
    unlockAudio()
    void handleUtterance(text || 'I attached a photo for context.', attachments)
  }
  const label = deepPending
    ? 'The real agent is working. This can take a minute. Keep talking if you want.'
    : phase === 'listening' ? 'Listening — pause when you are done'
    : phase === 'thinking' ? 'Thinking…'
    : phase === 'speaking' ? `${META[active].label} is speaking`
    : 'Ready'
  const voiceControls = () => <>
    <button className="dashboard-voice-control" onClick={talk} disabled={phase === 'thinking'} style={headerButtonStyle(phase === 'listening' ? '#f87171' : '#a78bfa')}>
      {phase === 'speaking' ? 'Interrupt' : phase === 'listening' ? 'Stop' : 'Talk'}
    </button>
    <button className="dashboard-voice-control" onClick={toggleLock} style={headerButtonStyle(locked ? '#c4b5fd' : '#94a3b8')}>
      {locked ? 'Unlock talk' : 'Lock talk'}
    </button>
    <button className="dashboard-voice-control" onClick={toggleBoth} aria-pressed={both} style={headerButtonStyle(both ? '#00b4ff' : '#94a3b8')}>
      {both ? 'Both on' : 'Both'}
    </button>
    <button className="dashboard-voice-control" onClick={goDeeper} style={headerButtonStyle('#a78bfa')}>
      {focused ? 'Compact' : 'Go deeper'}
    </button>
    {deepPending && <button className="dashboard-voice-control" onClick={() => { setOpen(true); setFocused(true) }} style={headerButtonStyle('#00b4ff')}>
      <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 10, background: '#00b4ff', marginRight: 5, animation: 'pulse 1.2s ease-in-out infinite' }} />Agent working
    </button>}
  </>

  return <>
    <style>{`@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.25 } }`}</style>
    <div className="dashboard-voice-header">
      <div className="dashboard-voice-desktop" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {voiceControls()}
      </div>
      <details className="dashboard-voice-mobile-menu">
        <summary>Talk</summary>
        <div className="dashboard-voice-mobile-menu-panel">
          {voiceControls()}
        </div>
      </details>
    </div>
    {open && <>
      {focused && <div onClick={() => { setOpen(false); setFocused(false) }} style={{ position: 'fixed', inset: 0, zIndex: 114, background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(3px)' }} />}
      <aside className={`dashboard-voice-panel${focused ? ' is-focused' : ''}`} style={focused
        ? { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 116, width: 'min(680px, calc(100vw - 48px))', maxHeight: 'calc(100vh - 96px)', overflowY: 'auto', background: '#0a0a12', border: '1px solid rgba(167,139,250,0.42)', borderRadius: 10, padding: 18, boxShadow: '0 30px 90px rgba(0,0,0,0.7)', display: 'grid', gap: 12 }
        : { position: 'fixed', left: 12, right: 12, bottom: 'calc(18px + env(safe-area-inset-bottom))', zIndex: 116, width: 'auto', maxWidth: 370, marginLeft: 'auto', boxSizing: 'border-box', overflowY: 'auto', background: '#0a0a12', border: '1px solid rgba(167,139,250,0.42)', borderRadius: 10, padding: 14, boxShadow: '0 22px 70px rgba(0,0,0,0.56)', display: 'grid', gap: 12 }}>
      <div className="dashboard-voice-panel-heading" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><div><strong style={{ color: '#f8fafc', fontSize: 14 }}>Dashboard conversation</strong><p style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>{focused ? 'Focused voice space — your dashboard remains behind it.' : 'Talk about the work while the board stays visible.'}</p></div><button aria-label="Close voice conversation" onClick={() => { setOpen(false); setFocused(false) }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button></div>
      <div className="dashboard-voice-settings" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="dashboard-voice-setting-group">
          <span style={{ color: '#64748b', fontSize: 11 }}>Audience</span>
          <button onClick={toggleBoth} style={togglePillStyle(both)}>Wendy + Ellie</button>
        </div>
        <div className="dashboard-voice-setting-group">
          <span style={{ color: '#64748b', fontSize: 11 }}>Mode</span>
          <button onClick={() => setMode('quick')} style={togglePillStyle(mode === 'quick')}>Quick</button>
          <button onClick={() => setMode('deep')} style={togglePillStyle(mode === 'deep')}>Deep</button>
        </div>
        <span className="dashboard-voice-mode-hint" style={{ color: '#475569', fontSize: 10 }}>{mode === 'deep' ? 'real terminal agent, slow' : 'fast voice reply'}</span>
      </div>
      <p style={{ color: deepPending ? '#00b4ff' : '#94a3b8', fontSize: 12, margin: 0 }}>
        {deepPending && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 10, background: '#00b4ff', marginRight: 6, animation: 'pulse 1.2s ease-in-out infinite' }} />}
        {label}
      </p>
      <div className="dashboard-voice-composer" style={{ display: 'flex', gap: 8 }}>
        <ImageAttachmentPicker images={images} onChange={setImages} disabled={phase === 'thinking' || deepPending} color="#a78bfa" />
        <input
          ref={messageInputRef}
          aria-label="Message the team"
          value={typedMessage}
          onChange={event => setTypedMessage(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendTypedMessage() } }}
          placeholder={both ? 'Message Wendy and Ellie…' : `Message ${META[active].label}…`}
          style={{ flex: 1, minWidth: 0, height: 34, border: '1px solid rgba(167,139,250,0.28)', borderRadius: 8, background: '#10111a', color: '#e2e8f0', padding: '0 10px', fontSize: 13, outline: 'none' }}
        />
        <button onClick={sendTypedMessage} disabled={(!typedMessage.trim() && images.length === 0) || phase === 'thinking' || deepPending} style={{ border: 0, borderRadius: 8, background: '#a78bfa', color: '#0a0a12', padding: '0 11px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
          Send
        </button>
      </div>
      {showText && <div style={{ display: 'flex', gap: 8 }}><button onClick={() => setShowText(false)} style={buttonStyle('#94a3b8')}>Hide text</button></div>}
      {(showText || focused || isMobileVoiceLayout()) && (log.length > 0
        ? <div className="dashboard-voice-transcript" style={{ display: 'grid', gap: 7, maxHeight: focused ? 360 : 220, overflowY: 'auto' }}>{log.map((entry, index) => <div key={index} style={{ background: '#10111a', color: entry.who === 'brad' ? '#cbd5e1' : META[entry.who].color, borderRadius: 7, padding: '8px 9px', fontSize: 12, lineHeight: 1.45 }}>{entry.text}</div>)}</div>
        : focused ? <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>Say something to start. I have your dashboard context loaded.</p> : null)}
      {error && <p style={{ color: '#f87171', fontSize: 12 }}>{error}</p>}
    </aside>
    </>}
  </>
}

function buttonStyle(color: string) { return { border: 'none', background: 'transparent', color, padding: '6px 6px', minHeight: 28, cursor: 'pointer', fontSize: 11, fontWeight: 700 } }
function headerButtonStyle(color: string) { return { height: 28, padding: '0 6px', border: 'none', background: 'transparent', color, cursor: 'pointer', fontSize: 10, fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap' as const } }
function togglePillStyle(on: boolean) { return { minHeight: 24, padding: '0 2px', border: 'none', background: 'transparent', color: on ? '#00b4ff' : '#64748b', cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap' as const } }
