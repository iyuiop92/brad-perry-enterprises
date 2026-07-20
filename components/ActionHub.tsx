'use client'
import { useState } from 'react'
import type { Task } from '@/lib/types'

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

const PHASE_SHORT: Record<string, string> = {
  discovery: 'DISC', design: 'DSGN', build: 'BUILD', launch: 'LNCH', live: 'LIVE',
}

function taskProgress(task: Task): number {
  if (task.deliverables?.length > 0) {
    const done = task.deliverables.filter(d => d.done).length
    return Math.round((done / task.deliverables.length) * 100)
  }
  const map: Record<string, number> = { idea: 5, in_progress: 50, blocked: 25, done: 100 }
  return map[task.status] ?? 0
}

export default function ActionHub({
  tasks,
  onSelectTask,
  onAddTask,
}: {
  tasks: Task[]
  onSelectTask: (task: Task) => void
  onAddTask: () => void
}) {
  const [input, setInput] = useState('')
  const [ripple, setRipple] = useState(false)
  const [recentCaptures, setRecentCaptures] = useState<string[]>([])

  const highImpact = tasks
    .filter(t => t.status === 'in_progress' || t.status === 'idea')
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    .slice(0, 6)

  const actionized = tasks.filter(t => t.status === 'blocked').slice(0, 3)

  async function capture() {
    const text = input.trim()
    if (!text) return
    setInput('')
    setRipple(true)
    setTimeout(() => setRipple(false), 500)
    setRecentCaptures(prev => [text, ...prev].slice(0, 2))
    await fetch('/api/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    }).catch(() => {})
  }

  return (
    <div className="flex flex-col h-full" style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
      {/* Panel header */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.35)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
            <span className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} />
            <span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
          </div>
          <span
            className="text-[10px] font-[800] uppercase tracking-[0.2em]"
            style={{ color: '#00b4ff', fontFamily: 'var(--font-outfit)' }}
          >
            Action Hub
          </span>
        </div>
        <button
          onClick={onAddTask}
          className="text-[9px] font-[700] px-2 py-1 rounded-md transition-opacity hover:opacity-80"
          style={{ background: 'rgba(0,180,255,0.1)', color: '#00b4ff', border: '1px solid rgba(0,180,255,0.2)' }}
        >
          + NEW
        </button>
      </div>

      {/* Terminal capture input */}
      <div
        className="shrink-0 px-4 py-3 relative"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        {ripple && (
          <div
            className="absolute inset-0 pointer-events-none rounded"
            style={{ animation: 'inbox-ripple 0.5s ease-out forwards', border: '1px solid rgba(0,180,255,0.5)' }}
          />
        )}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[8px] font-[700] px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(0,180,255,0.08)', color: '#00b4ff', border: '1px solid rgba(0,180,255,0.18)' }}
          >
            ● WENDY AI IS ACTIVE
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-[700] shrink-0" style={{ color: '#00b4ff' }}>›</span>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && capture()}
            placeholder="Type new request or capture..."
            className="flex-1 bg-transparent outline-none text-xs"
            style={{ color: '#cbd5e1', caretColor: '#00b4ff' }}
          />
        </div>
        {recentCaptures.map((c, i) => (
          <div
            key={i}
            className="text-[10px] mt-1.5 px-2 py-1 rounded"
            style={{ background: 'rgba(0,180,255,0.04)', color: '#334155', border: '1px solid rgba(0,180,255,0.08)' }}
          >
            ✓ {c}
          </div>
        ))}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-4">
        {/* High impact */}
        <div>
          <p
            className="text-[9px] font-[700] uppercase tracking-[0.2em] mb-2 px-1"
            style={{ color: '#334155' }}
          >
            High Impact
          </p>
          <div className="flex flex-col gap-1.5">
            {highImpact.length === 0 && (
              <p className="text-[11px] px-2" style={{ color: '#1e293b' }}>No active tasks</p>
            )}
            {highImpact.map(task => {
              const progress = taskProgress(task)
              const barColor = progress > 70 ? '#22c55e' : progress > 30 ? '#00b4ff' : '#f59e0b'
              return (
                <button
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className="text-left rounded-lg px-3 py-2.5 transition-all"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="text-xs font-[500] leading-snug" style={{ color: '#cbd5e1' }}>
                      {task.title}
                    </span>
                    <span className="text-[10px] font-[800] shrink-0" style={{ color: barColor }}>
                      {progress}%
                    </span>
                  </div>
                  <div className="h-0.5 rounded-full mb-1.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${progress}%`, background: barColor }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[8px]" style={{ color: '#283044' }}>
                      AI Confidence: <span style={{ color: '#22c55e' }}>100%</span>
                    </span>
                    {task.phase && (
                      <span
                        className="text-[8px] px-1.5 py-0.5 rounded font-[700]"
                        style={{ background: 'rgba(0,180,255,0.08)', color: '#00b4ff' }}
                      >
                        {PHASE_SHORT[task.phase] ?? task.phase.toUpperCase()}
                      </span>
                    )}
                    <span
                      className="text-[8px] px-1.5 py-0.5 rounded font-[700] ml-auto"
                      style={{
                        background:
                          task.priority === 'high'
                            ? 'rgba(34,197,94,0.1)'
                            : task.priority === 'medium'
                            ? 'rgba(245,158,11,0.1)'
                            : 'rgba(239,68,68,0.1)',
                        color:
                          task.priority === 'high'
                            ? '#22c55e'
                            : task.priority === 'medium'
                            ? '#f59e0b'
                            : '#ef4444',
                      }}
                    >
                      {task.priority.toUpperCase()}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Actionized (to do) */}
        {actionized.length > 0 && (
          <div>
            <p
              className="text-[9px] font-[700] uppercase tracking-[0.2em] mb-2 px-1"
              style={{ color: '#f59e0b' }}
            >
              Actionized
            </p>
            <div className="flex flex-col gap-1.5">
              {actionized.map(task => (
                <button
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className="text-left rounded-lg px-3 py-2 transition-all"
                  style={{
                    background: 'rgba(245,158,11,0.04)',
                    border: '1px solid rgba(245,158,11,0.12)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.09)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.04)' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#f59e0b' }} />
                    <span className="text-xs truncate" style={{ color: '#94a3b8' }}>{task.title}</span>
                  </div>
                  <p className="text-[9px] mt-0.5 pl-3.5" style={{ color: '#475569' }}>
                    Prioritiz: <span style={{ color: '#f59e0b' }}>To do</span>
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Activity stream */}
      <div
        className="shrink-0 px-4 py-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.25)' }}
      >
        <p className="text-[9px] truncate" style={{ color: '#1e293b' }}>
          Real-time activity stream:{' '}
          <span style={{ color: '#283044' }}>WENDY AI IS ACTIVE</span>
        </p>
      </div>
    </div>
  )
}
