'use client'

import { useEffect, useRef, useState } from 'react'
import { DefaultChatTransport } from 'ai'
import { useChat } from '@ai-sdk/react'
import type { Task, Workspace } from '@/lib/types'

function workspaceSummary(workspaces: Workspace[], tasks: Task[]) {
  const openTasks = tasks.filter(task => task.status !== 'done')
  const active = openTasks.filter(task => task.status === 'in_progress').length
  const todo = openTasks.filter(task => task.status === 'blocked').length
  const high = openTasks.filter(task => task.priority === 'high').length

  return {
    active,
    todo,
    high,
    workspaceCount: workspaces.length,
  }
}

export default function SamPanel({
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
    transport: new DefaultChatTransport({ api: '/api/dashboard/sam' }),
  })

  const isStreaming = status === 'streaming'
  const summary = workspaceSummary(workspaces, tasks)

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
    <div className="flex flex-col h-full" style={{ borderLeft: '1px solid rgba(45,212,191,0.14)' }}>
      <div
        className="shrink-0 px-4 py-3 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.4)' }}
      >
        <div
          className="w-7 h-7 flex items-center justify-center shrink-0"
          style={{ background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.3)', borderRadius: 7 }}
        >
          <span className="text-[10px] font-[850]" style={{ color: '#2dd4bf' }}>S</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-[850]" style={{ color: '#e2e8f0', fontFamily: 'var(--font-outfit)' }}>
              Sam
            </p>
            <span className="text-[10px] font-[750]" style={{ color: '#2dd4bf' }}>GEMINI</span>
          </div>
          <p className="text-[11px]" style={{ color: '#64748b' }}>
            {selectedWs ? `Reading ${selectedWs.name}` : 'Research, synthesis, and next-question support'}
          </p>
        </div>
      </div>

      <div className="shrink-0 px-3 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7 }}>
          {[
            { label: 'Active', value: summary.active, color: '#38bdf8' },
            { label: 'To do', value: summary.todo, color: '#f59e0b' },
            { label: 'High', value: summary.high, color: '#2dd4bf' },
          ].map(item => (
            <div
              key={item.label}
              style={{
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.025)',
                borderRadius: 7,
                padding: '8px 9px',
              }}
            >
              <p style={{ color: item.color, fontSize: 15, fontWeight: 900, lineHeight: 1 }}>{item.value}</p>
              <p style={{ color: '#64748b', fontSize: 11, fontWeight: 750, marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2 mt-2">
            <p className="text-[13px] px-1" style={{ color: '#64748b', lineHeight: 1.5 }}>
              Use Sam for synthesis, research framing, model comparison, and finding the question that unlocks the next move.
            </p>
            {[
              'What am I not seeing in this dashboard?',
              'Compare the next two moves and pick one.',
              'Help me frame the research question.',
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
                  borderRadius: 7,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(45,212,191,0.08)' }}
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
                <span className="text-[10px] font-[750] px-1" style={{ color: '#2dd4bf' }}>SAM</span>
              )}
              <div
                className="px-3 py-2 text-sm leading-relaxed"
                style={{
                  maxWidth: '88%',
                  background: isUser ? 'rgba(45,212,191,0.12)' : 'rgba(255,255,255,0.03)',
                  border: isUser ? '1px solid rgba(45,212,191,0.25)' : '1px solid rgba(255,255,255,0.05)',
                  color: isUser ? '#e2e8f0' : '#cbd5e1',
                  borderRadius: 8,
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
            <div className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#2dd4bf' }} />
            <div className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#2dd4bf', animationDelay: '0.15s' }} />
            <div className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#2dd4bf', animationDelay: '0.3s' }} />
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
            border: '1px solid rgba(45,212,191,0.16)',
            borderRadius: 8,
          }}
        >
          <span className="text-sm font-[750] shrink-0" style={{ color: '#2dd4bf' }}>›</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask Sam to synthesize..."
            disabled={isStreaming}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: '#cbd5e1', caretColor: '#2dd4bf' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="shrink-0 text-[11px] font-[750] px-2 py-1 transition-all"
            style={{
              background: 'rgba(45,212,191,0.14)',
              color: '#99f6e4',
              border: '1px solid rgba(45,212,191,0.22)',
              borderRadius: 5,
              opacity: input.trim() && !isStreaming ? 1 : 0,
              pointerEvents: input.trim() && !isStreaming ? 'auto' : 'none',
            }}
          >
            SEND
          </button>
        </div>
        <p className="text-[10px] text-center mt-1.5" style={{ color: '#334155' }}>
          Sam runs on Gemini and keeps a separate thread from Wendy, Ellie, and Cleaver.
        </p>
      </div>
    </div>
  )
}
