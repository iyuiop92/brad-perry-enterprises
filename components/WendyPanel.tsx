'use client'
import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { Workspace, Task } from '@/lib/types'

function generateInsights(workspaces: Workspace[], tasks: Task[], selectedWs: Workspace | null): string[] {
  const insights: string[] = []
  const ws = selectedWs ?? null

  const allBlocked = tasks.filter(t => t.status === 'blocked')
  const allActive = tasks.filter(t => t.status === 'in_progress')
  const highPri = tasks.filter(t => t.priority === 'high' && t.status !== 'done')

  if (allBlocked.length > 0) {
    insights.push(`${allBlocked.length} blocked task${allBlocked.length > 1 ? 's' : ''} need attention across your portfolio`)
  }
  if (highPri.length > 0) {
    insights.push(`${highPri.length} high-priority item${highPri.length > 1 ? 's' : ''} still in motion`)
  }

  const mostActive = [...workspaces].sort((a, b) => b.active_count - a.active_count)[0]
  if (mostActive?.active_count > 0) {
    insights.push(`${mostActive.name} is your highest-velocity workspace right now`)
  }

  if (ws) {
    const wsBlocked = tasks.filter(t => t.workspace_id === ws.id && t.status === 'blocked')
    if (wsBlocked.length > 0) {
      insights.push(`${ws.name} has ${wsBlocked.length} blocker${wsBlocked.length > 1 ? 's' : ''} — clear these before adding new work`)
    }
    const wsActive = tasks.filter(t => t.workspace_id === ws.id && t.status === 'in_progress')
    if (wsActive.length > 4) {
      insights.push(`${ws.name} is spread across ${wsActive.length} active tasks — consider focusing to 2–3`)
    }
  }

  if (insights.length === 0) {
    insights.push('Portfolio is clean. Good time to push new initiatives.')
  }

  return insights.slice(0, 3)
}

export default function WendyPanel({
  workspaces,
  tasks,
  selectedWs,
}: {
  workspaces: Workspace[]
  tasks: Task[]
  selectedWs: Workspace | null
}) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/dashboard/wendy' }),
  })

  const insights = generateInsights(workspaces, tasks, selectedWs)
  const isStreaming = status === 'streaming'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend() {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    sendMessage({ role: 'user', parts: [{ type: 'text', text }] })
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ borderLeft: '1px solid rgba(0,180,255,0.08)' }}
    >
      {/* Panel header */}
      <div
        className="shrink-0 px-4 py-3 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.4)' }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'rgba(0,180,255,0.1)', border: '1px solid rgba(0,180,255,0.25)' }}
        >
          <span className="text-[10px] font-[800]" style={{ color: '#00b4ff' }}>W</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-[800]" style={{ color: '#e2e8f0', fontFamily: 'var(--font-outfit)' }}>
              Wendy
            </p>
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: '#00b4ff',
                animation: 'breathe 2s ease-in-out infinite',
                '--glow-color': '#00b4ff66',
                '--glow-min': '2px',
                '--glow-max': '7px',
              } as React.CSSProperties}
            />
            <span className="text-[8px] font-[700]" style={{ color: '#00b4ff' }}>LIVE</span>
          </div>
          <p className="text-[9px]" style={{ color: '#334155' }}>
            {selectedWs ? `Focused on ${selectedWs.name}` : 'Full portfolio view'}
          </p>
        </div>
      </div>

      {/* AI Insight cards */}
      <div className="shrink-0 px-3 py-3 flex flex-col gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <p className="text-[8px] font-[700] uppercase tracking-[0.2em] px-1" style={{ color: '#334155' }}>
          Live Insights
        </p>
        {insights.map((insight, i) => (
          <div
            key={i}
            className="rounded-lg px-3 py-2"
            style={{
              background: 'rgba(0,180,255,0.04)',
              border: '1px solid rgba(0,180,255,0.1)',
            }}
          >
            <p className="text-[10px] leading-relaxed" style={{ color: '#64748b' }}>
              <span style={{ color: '#00b4ff', marginRight: 4 }}>✦</span>
              {insight}
            </p>
          </div>
        ))}
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2 mt-2">
            <p className="text-[10px] px-1" style={{ color: '#1e293b' }}>
              Ask me anything about your portfolio, tasks, or next moves.
            </p>
            {[
              'What should I focus on today?',
              'What\'s blocking my momentum?',
              'What\'s the highest-leverage task right now?',
            ].map(suggestion => (
              <button
                key={suggestion}
                onClick={() => {
                  setInput(suggestion)
                  inputRef.current?.focus()
                }}
                className="text-left text-[10px] px-3 py-2 rounded-lg transition-all"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  color: '#475569',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,180,255,0.05)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
              >
                › {suggestion}
              </button>
            ))}
          </div>
        )}

        {messages.map(msg => {
          const isUser = msg.role === 'user'
          const text = msg.parts
            ?.filter((p: { type: string }) => p.type === 'text')
            .map((p: { type: string; text?: string }) => p.text ?? '')
            .join('') ?? ''

          if (!text) return null
          return (
            <div key={msg.id} className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
              {!isUser && (
                <span className="text-[8px] font-[700] px-1" style={{ color: '#00b4ff' }}>WENDY</span>
              )}
              <div
                className="rounded-xl px-3 py-2 text-xs leading-relaxed"
                style={{
                  maxWidth: '88%',
                  background: isUser
                    ? 'rgba(0,180,255,0.1)'
                    : 'rgba(255,255,255,0.03)',
                  border: isUser
                    ? '1px solid rgba(0,180,255,0.2)'
                    : '1px solid rgba(255,255,255,0.05)',
                  color: isUser ? '#e2e8f0' : '#94a3b8',
                }}
              >
                {text}
              </div>
            </div>
          )
        })}

        {isStreaming && (
          <div className="flex items-center gap-1.5 px-1">
            <div className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#00b4ff' }} />
            <div className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#00b4ff', animationDelay: '0.15s' }} />
            <div className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#00b4ff', animationDelay: '0.3s' }} />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="shrink-0 px-3 py-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.3)' }}
      >
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(0,180,255,0.12)',
          }}
        >
          <span className="text-sm font-[700] shrink-0" style={{ color: '#00b4ff' }}>›</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask Wendy anything..."
            disabled={isStreaming}
            className="flex-1 bg-transparent outline-none text-xs"
            style={{ color: '#cbd5e1', caretColor: '#00b4ff' }}
          />
          {input.trim() && !isStreaming && (
            <button
              onClick={handleSend}
              className="shrink-0 text-[9px] font-[700] px-2 py-1 rounded-md transition-opacity hover:opacity-80"
              style={{ background: 'rgba(0,180,255,0.12)', color: '#00b4ff', border: '1px solid rgba(0,180,255,0.2)' }}
            >
              SEND
            </button>
          )}
        </div>
        <p className="text-[8px] text-center mt-1.5" style={{ color: '#1e293b' }}>
          Wendy knows your full portfolio — Wendy AI
        </p>
      </div>
    </div>
  )
}
