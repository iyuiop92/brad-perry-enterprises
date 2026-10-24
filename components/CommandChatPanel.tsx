'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { ExecutiveAgent } from '@/lib/dashboard-chat'

type Message = { id: string; role: string; content: string; status: string; error?: string }
const names: Record<string, string> = { user: 'Brad', claude: 'Wendy', codex: 'Ellie', system: 'System' }

// Selected workspace is mirrored to localStorage by app/dashboard/page.tsx.
// This panel now lives in the layout rail and has no access to page state, so
// this is how the workspace prefix survived the move out of the page. The
// `workspaces` and `tasks` props were accepted and never read, so they are gone.
const WORKSPACE_KEY = 'bpe.selectedWorkspace'
type SelectedWorkspace = { id: string; name: string }

function readWorkspace(): SelectedWorkspace | null {
  try {
    const raw = window.localStorage.getItem(WORKSPACE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return typeof parsed?.id === 'string' && typeof parsed?.name === 'string' ? parsed : null
  } catch { return null }
}

// First meaningful line of a message, trimmed so it reads as a card title
// rather than a paragraph.
function titleFrom(content: string) {
  const line = content.split('\n').map(part => part.trim()).find(Boolean) ?? content.trim()
  return line.length > 90 ? `${line.slice(0, 87).trimEnd()}...` : line
}

export default function CommandChatPanel({ agent, onAgentChange }: {
  agent: ExecutiveAgent; onAgentChange: (agent: ExecutiveAgent) => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [health, setHealth] = useState<{ online: boolean; wendyMemoryReady?: boolean } | null>(null)
  const [input, setInput] = useState(''), [sending, setSending] = useState(false), [error, setError] = useState('')
  const [workspace, setWorkspace] = useState<SelectedWorkspace | null>(null)
  // Message currently being promoted to a card, plus its editable title.
  const [draft, setDraft] = useState<{ id: string; title: string; owner: 'brad' | 'ellie' } | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const bottom = useRef<HTMLDivElement>(null)
  const request = useRef<{ content: string; target: string; id: string } | null>(null)

  useEffect(() => {
    setWorkspace(readWorkspace())
    const sync = () => setWorkspace(readWorkspace())
    window.addEventListener('storage', sync)
    window.addEventListener('bpe:workspace', sync)
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('bpe:workspace', sync) }
  }, [])

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
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3000); return () => clearTimeout(timer) }, [toast])

  async function send() {
    if (!input.trim() || sending) return
    const content = workspace ? `[Workspace: ${workspace.name}]\n${input.trim()}` : input.trim()
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

  // Promote a message onto the bpe_tasks board. The editable title is the first
  // line; the whole message is kept as notes so nothing is lost in the move.
  async function createTask(message: Message) {
    if (!draft || saving) return
    const title = draft.title.trim()
    if (!title) return
    setSaving(true)
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          notes: message.content,
          status: 'idea',
          owner: draft.owner,
          brand: workspace?.name ?? null,
          workspace_id: workspace?.id ?? null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not create the card.')
      setToast(`Card created for ${draft.owner === 'ellie' ? 'Ellie' : 'you'}. Open the Board to see it.`)
      setDraft(null)
      window.dispatchEvent(new Event('bpe:tasks'))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create the card.') }
    finally { setSaving(false) }
  }

  const actionButton = {
    padding: '3px 8px', borderRadius: 10, fontSize: 12, fontWeight: 700,
    background: 'transparent', border: '1px solid rgba(148,163,184,0.25)',
    color: '#94a3b8', cursor: 'pointer',
  } as const

  return <section className="flex flex-col h-full min-h-0" aria-label="Command Room">
    <header className="p-3 border-b border-white/10">
      <div className="flex gap-2">{(['wendy', 'ellie'] as const).map(name => <button key={name} aria-pressed={agent === name} onClick={() => onAgentChange(name)} className="px-3 py-2 rounded-[10px] text-[15px] font-[700] text-slate-200" style={{ background: agent === name ? '#164e63' : '#0f172a' }}>{name === 'wendy' ? 'Wendy' : 'Ellie'}</button>)}</div>
      <p role="status" className="text-[13px] mt-2 text-slate-300">{health === null ? 'Checking connection…' : !health.online ? 'Worker offline. Saved messages wait for this Mac to reconnect.' : health.wendyMemoryReady ? 'Wendy connected · persistent business conversation' : 'Wendy memory connection needs setup.'}</p>
      <p className="text-[13px] mt-1 text-slate-400">One conversation across BPE. {workspace ? `Current workspace: ${workspace.name}.` : ''}</p>
      <Link href="/dashboard/bridge" className="text-[13px] text-sky-400">Full conversation and attachments</Link>
    </header>
    <div className="flex-1 overflow-y-auto p-3 space-y-3" aria-label="Messages">{messages.map(message => <article key={message.id} className="p-3 rounded-[10px] bg-white/5">
      <p className="text-[13px] font-[700] text-sky-300 mb-1">{names[message.role] || message.role}</p>
      <p className="text-[16px] leading-relaxed text-slate-200 whitespace-pre-wrap break-words">{message.content}</p>
      {message.role === 'user' && <p className="text-[12px] mt-1 text-slate-400">{message.status === 'pending' ? 'Saved · queued' : message.status === 'processing' ? 'Working…' : message.status === 'error' ? `Needs attention: ${message.error || 'Worker could not finish.'}` : 'Answered'}</p>}

      {/* Promote any message onto the board. Always rendered rather than shown
          on hover: there is no hover on a phone, and a hidden control is a
          control Brad will never find. */}
      {message.content.trim() && draft?.id !== message.id && (
        <div className="flex flex-wrap gap-2 mt-2">
          <button style={actionButton} onClick={() => setDraft({ id: message.id, title: titleFrom(message.content), owner: 'brad' })}>+ Card</button>
          <button style={actionButton} onClick={() => setDraft({ id: message.id, title: titleFrom(message.content), owner: 'ellie' })}>Assign Ellie</button>
          <button style={actionButton} onClick={() => { void navigator.clipboard.writeText(message.content); setToast('Copied.') }}>Copy</button>
        </div>
      )}
      {draft?.id === message.id && (
        <div className="mt-2 p-2 rounded-[10px]" style={{ border: '1px solid rgba(0,180,255,0.28)' }}>
          <label className="text-[12px] text-slate-400" htmlFor={`card-title-${message.id}`}>Card title</label>
          <input
            id={`card-title-${message.id}`}
            value={draft.title}
            onChange={event => setDraft({ ...draft, title: event.target.value })}
            onKeyDown={event => { if (event.key === 'Enter') void createTask(message); if (event.key === 'Escape') setDraft(null) }}
            className="w-full mt-1 bg-slate-900 rounded-[10px] p-2 text-[16px] text-white"
          />
          <p className="text-[12px] mt-1 text-slate-400">Goes to Idea, owned by {draft.owner === 'ellie' ? 'Ellie' : 'you'}. The full message is saved as notes.</p>
          <div className="flex gap-2 mt-2">
            <button disabled={saving || !draft.title.trim()} onClick={() => void createTask(message)} className="px-3 py-2 rounded-[10px] text-[15px] font-[700] disabled:opacity-40" style={{ background: '#164e63', color: '#e2e8f0' }}>{saving ? 'Creating…' : 'Create card'}</button>
            <button onClick={() => setDraft(null)} className="px-3 py-2 rounded-[10px] text-[15px] text-slate-400">Cancel</button>
          </div>
        </div>
      )}
    </article>)}<div ref={bottom} /></div>
    {toast && <p role="status" className="px-3 text-[13px] text-sky-300">{toast}</p>}
    {error && <p role="alert" className="px-3 text-[13px] text-red-300">{error}</p>}
    <form className="p-3 flex gap-2" onSubmit={event => { event.preventDefault(); void send() }}>
      <input aria-label={`Message ${agent}`} value={input} onChange={event => setInput(event.target.value)} disabled={sending} placeholder={`Message ${agent === 'wendy' ? 'Wendy' : 'Ellie'}…`} className="min-w-0 flex-1 bg-slate-900 rounded-[10px] p-3 text-[16px] text-white" />
      <button disabled={sending || !input.trim()} className="px-3 text-[15px] font-[700] text-sky-300 disabled:opacity-40">{sending ? 'Saving…' : 'Send'}</button>
    </form>
    <p className="px-3 pb-2 text-[13px] text-slate-400">Terminal agents can carry out your requests. Text chat does not generate ElevenLabs audio.</p>
  </section>
}
