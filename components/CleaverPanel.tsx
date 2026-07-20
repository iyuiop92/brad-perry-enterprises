'use client'

import { useEffect, useRef, useState } from 'react'
import { DefaultChatTransport } from 'ai'
import { useChat } from '@ai-sdk/react'
import type { Task, Workspace } from '@/lib/types'

function localSummary(workspaces: Workspace[], tasks: Task[]) {
  const openTasks = tasks.filter(task => task.status !== 'done')
  const todo = openTasks.filter(task => task.status === 'blocked').length
  const active = openTasks.filter(task => task.status === 'in_progress').length
  const ideas = openTasks.filter(task => task.status === 'idea').length

  return { active, todo, ideas, workspaces: workspaces.length }
}

export default function CleaverPanel({
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
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const inputRef = useRef<HTMLInputElement>(null)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/dashboard/cleaver' }),
  })

  const isStreaming = status === 'streaming'
  const summary = localSummary(workspaces, tasks)

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    if (isAtBottomRef.current) el.scrollTop = el.scrollHeight
  }, [messages])

  function handleScroll() {
    const el = scrollContainerRef.current
    if (!el) return
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
  }

  function handleSend() {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    sendMessage({ role: 'user', parts: [{ type: 'text', text }] })
  }

  return (
    <div className="flex flex-col h-full" style={{ borderLeft: '1px solid rgba(34,197,94,0.16)' }}>
      <div
        className="shrink-0 px-4 py-3 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.42)' }}
      >
        <div
          className="w-7 h-7 flex items-center justify-center shrink-0"
          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.28)', borderRadius: 5 }}
        >
          <span className="text-[10px] font-[850]" style={{ color: '#22c55e' }}>C</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-[850]" style={{ color: '#e2e8f0', fontFamily: 'var(--font-outfit)' }}>
              Cleaver
            </p>
            <span className="text-[10px] font-[750]" style={{ color: '#22c55e' }}>REASON</span>
          </div>
          <p className="text-[11px]" style={{ color: '#64748b' }}>
            {selectedWs ? `Stepping back on ${selectedWs.name}` : 'Steady repair logic and tradeoffs'}
          </p>
        </div>
      </div>

      <div className="shrink-0 px-3 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 7 }}>
          {[
            { label: 'Active', value: summary.active, color: '#38bdf8' },
            { label: 'To do', value: summary.todo, color: '#f59e0b' },
            { label: 'Ideas', value: summary.ideas, color: '#f472b6' },
            { label: 'Areas', value: summary.workspaces, color: '#22c55e' },
          ].map(item => (
            <div
              key={item.label}
              style={{
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.025)',
                borderRadius: 5,
                padding: '8px 7px',
              }}
            >
              <p style={{ color: item.color, fontSize: 14, fontWeight: 900, lineHeight: 1 }}>{item.value}</p>
              <p style={{ color: '#64748b', fontSize: 11, fontWeight: 750, marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2 mt-2">
            <p className="text-[13px] px-1" style={{ color: '#64748b', lineHeight: 1.5 }}>
              Use Cleaver for private local thinking, repair logic, tradeoffs, and stepping back before you start moving pieces.
            </p>
            {[
              'What is the real constraint here?',
              'Help me choose the durable next move.',
              'Look at this work like a fixer, not a planner.',
            ].map(suggestion => (
              <button
                key={suggestion}
                onClick={() => {
                  setInput(suggestion)
                  inputRef.current?.focus()
                }}
                className="text-left text-[13px] px-3 py-2 transition-all"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  color: '#94a3b8',
                  borderRadius: 5,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {messages.map(msg => {
          const isUser = msg.role === 'user'
          const text = msg.parts
            ?.filter((part: { type: string }) => part.type === 'text')
            .map((part: { type: string; text?: string }) => part.text ?? '')
            .join('') ?? ''

          if (!text) return null
          return (
            <div key={msg.id} className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
              {!isUser && (
                <span className="text-[10px] font-[750] px-1" style={{ color: '#22c55e' }}>CLEAVER</span>
              )}
              <div
                className="px-3 py-2 text-sm leading-relaxed"
                style={{
                  maxWidth: '88%',
                  background: isUser ? 'rgba(34,197,94,0.11)' : 'rgba(255,255,255,0.03)',
                  border: isUser ? '1px solid rgba(34,197,94,0.23)' : '1px solid rgba(255,255,255,0.05)',
                  color: isUser ? '#e2e8f0' : '#cbd5e1',
                  borderRadius: 5,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {text}
              </div>
            </div>
          )
        })}

        {isStreaming && (
          <div className="flex items-center gap-1.5 px-1">
            <div className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
            <div className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#22c55e', animationDelay: '0.15s' }} />
            <div className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#22c55e', animationDelay: '0.3s' }} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div
        className="shrink-0 px-3 py-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.3)' }}
      >
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(34,197,94,0.16)',
            borderRadius: 5,
          }}
        >
          <span className="text-sm font-[750] shrink-0" style={{ color: '#22c55e' }}>›</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask Cleaver to reason locally..."
            disabled={isStreaming}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: '#cbd5e1', caretColor: '#22c55e' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="shrink-0 text-[11px] font-[750] px-2 py-1 transition-all"
            style={{
              background: 'rgba(34,197,94,0.14)',
              color: '#86efac',
              border: '1px solid rgba(34,197,94,0.22)',
              borderRadius: 5,
              opacity: input.trim() && !isStreaming ? 1 : 0,
              pointerEvents: input.trim() && !isStreaming ? 'auto' : 'none',
            }}
          >
            SEND
          </button>
        </div>
        <p className="text-[10px] text-center mt-1.5" style={{ color: '#334155' }}>
          Cleaver uses local Ollama when reachable, with Gemini as the production fallback.
        </p>
      </div>
    </div>
  )
}
