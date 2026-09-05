'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Task, Workspace } from '@/lib/types'
import type { ExecutiveAgent } from '@/lib/dashboard-chat'

type Message = { id: string; role: string; content: string; status: string; error?: string }
const names: Record<string, string> = { user: 'Brad', claude: 'Wendy', codex: 'Ellie', system: 'System' }

export default function CommandChatPanel({ agent, onAgentChange, selectedWs }: {
  agent: ExecutiveAgent; onAgentChange: (agent: ExecutiveAgent) => void;
  workspaces: Workspace[]; tasks: Task[]; selectedWs: Workspace | null
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [health, setHealth] = useState<{ online: boolean; wendyMemoryReady?: boolean } | null>(null)
  const [input, setInput] = useState(''), [sending, setSending] = useState(false), [error, setError] = useState('')
  const bottom = useRef<HTMLDivElement>(null)
  const request = useRef<{ content: string; target: string; id: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      try {
        const [response, status] = await Promise.all([fetch('/api/bridge', { cache: 'no-store' }), fetch('/api/bridge?health=1', { cache: 'no-store' })])
        if (!response.ok) throw new Error('Conversation unavailable. Check your connection or sign in again.')
        const rows = await response.json(), state = status.ok ? await status.json() : { online: false }
        if (!cancelled) { setMessages(rows); setHealth(state) }
      } catch (cause) { if (!cancelled) { setHealth({ online: false }); setError(cause instanceof Error ? cause.message : 'Connection interrupted.') } }
      finally { if (!cancelled) timer = setTimeout(poll, 2000) }
    }
    void poll()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [])
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest' }) }, [messages.length])
  async function send() {
    if (!input.trim() || sending) return
    const content = selectedWs ? `[Workspace: ${selectedWs.name}]\n${input.trim()}` : input.trim()
    const target = agent === 'wendy' ? 'claude' : 'codex'
    if (request.current?.content !== content || request.current?.target !== target) request.current = { content, target, id: crypto.randomUUID() }
    setSending(true); setError('')
    try {
      const response = await fetch('/api/bridge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, target, clientMessageId: request.current.id }) })
      const saved = await response.json()
      if (!response.ok) throw new Error(saved.error || 'Message was not accepted.')
      setMessages(rows => rows.some(row => row.id === saved.id) ? rows : [...rows, saved])
      setInput(''); request.current = null
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not confirm delivery. Your message is still here; retry safely.') }
    finally { setSending(false) }
  }
  return <section className="flex flex-col h-full min-h-0" aria-label="Command Room">
    <header className="p-3 border-b border-white/10">
      <div className="flex gap-2">{(['wendy', 'ellie'] as const).map(name => <button key={name} aria-pressed={agent === name} onClick={() => onAgentChange(name)} className="px-3 py-2 rounded-[10px] text-slate-200" style={{ background: agent === name ? '#164e63' : '#0f172a' }}>{name === 'wendy' ? 'Wendy' : 'Ellie'}</button>)}</div>
      <p role="status" className="text-xs mt-2 text-slate-300">{health === null ? 'Checking connection…' : !health.online ? 'Worker offline. Saved messages wait for this Mac to reconnect.' : health.wendyMemoryReady ? 'Wendy connected · persistent business conversation' : 'Wendy memory connection needs setup.'}</p>
      <p className="text-xs mt-1 text-slate-400">One conversation across BPE. {selectedWs ? `Current workspace: ${selectedWs.name}.` : ''}</p>
      <Link href="/dashboard/bridge" className="text-xs text-sky-400">Full conversation and attachments</Link>
    </header>
    <div className="flex-1 overflow-y-auto p-3 space-y-3" aria-label="Messages">{messages.map(message => <article key={message.id} className="p-3 rounded-[10px] bg-white/5">
      <p className="text-xs text-sky-300">{names[message.role] || message.role}</p>
      <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">{message.content}</p>
      {message.role === 'user' && <p className="text-xs mt-1 text-slate-400">{message.status === 'pending' ? 'Saved · queued' : message.status === 'processing' ? 'Working…' : message.status === 'error' ? `Needs attention: ${message.error || 'Worker could not finish.'}` : 'Answered'}</p>}
    </article>)}<div ref={bottom} /></div>
    {error && <p role="alert" className="px-3 text-xs text-red-300">{error}</p>}
    <form className="p-3 flex gap-2" onSubmit={event => { event.preventDefault(); void send() }}>
      <input aria-label={`Message ${agent}`} value={input} onChange={event => setInput(event.target.value)} disabled={sending} placeholder={`Message ${agent === 'wendy' ? 'Wendy' : 'Ellie'}…`} className="min-w-0 flex-1 bg-slate-900 rounded-[10px] p-3 text-sm text-white" />
      <button disabled={sending || !input.trim()} className="px-3 text-sky-300 disabled:opacity-40">{sending ? 'Saving…' : 'Send'}</button>
    </form>
    <p className="px-3 pb-2 text-[11px] text-slate-400">Terminal agents can carry out your requests. Text chat does not generate ElevenLabs audio.</p>
  </section>
}
