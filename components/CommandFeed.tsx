'use client'
import { useState } from 'react'
import type { Task, Workspace } from '@/lib/types'

// ── Sparkline ──────────────────────────────────────────────────────────────
function seededSparkline(seed: string, points = 12): number[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 0x9e3779b9) | 0
  }
  const vals: number[] = []
  let val = 50
  for (let i = 0; i < points; i++) {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) | 0
    val = Math.max(8, Math.min(92, val + ((Math.abs(h) % 22) - 10)))
    vals.push(val)
  }
  return vals
}

function Sparkline({ seed, color }: { seed: string; color: string }) {
  const vals = seededSparkline(seed)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const w = 80
  const h = 24
  const pts = vals.map((v, i) => ({
    x: (i / (vals.length - 1)) * w,
    y: h - 2 - ((v - min) / range) * (h - 4),
  }))
  const line = pts.reduce((acc, pt, i) => {
    if (i === 0) return `M${pt.x},${pt.y}`
    const prev = pts[i - 1]
    const mx = (prev.x + pt.x) / 2
    return `${acc} C${mx},${prev.y} ${mx},${pt.y} ${pt.x},${pt.y}`
  }, '')
  const gradId = `sf-${seed.replace(/-/g, '').slice(0, 10)}`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ── Brand Orb ──────────────────────────────────────────────────────────────
function BrandOrb({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="shrink-0 flex items-center justify-center rounded-full text-[11px] font-[800]"
      style={{
        width: 32, height: 32,
        background: `${color}18`,
        border: `1px solid ${color}40`,
        color,
        boxShadow: `0 0 8px ${color}20`,
        fontFamily: 'var(--font-outfit)',
      }}
    >
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

// ── Task progress ──────────────────────────────────────────────────────────
function taskProgress(task: Task): number {
  if (task.deliverables?.length > 0) {
    const done = task.deliverables.filter(d => d.done).length
    return Math.round((done / task.deliverables.length) * 100)
  }
  const map: Record<string, number> = { idea: 5, in_progress: 50, blocked: 25, done: 100 }
  return map[task.status] ?? 0
}

function healthPulse(ws: Workspace): number {
  if (ws.task_count === 0) return 50
  return Math.min(100, Math.round(
    ((ws.active_count * 2 + (ws.task_count - ws.blocked_count)) / (ws.task_count * 3)) * 100
  ))
}

const PRIORITY_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  high:   { label: 'P1', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  medium: { label: 'P2', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  low:    { label: 'P3', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

const PHASE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  discovery: { label: 'DISC', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  design:    { label: 'DSGN', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  build:     { label: 'BUILD', color: '#00b4ff', bg: 'rgba(0,180,255,0.12)' },
  launch:    { label: 'LNCH', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  live:      { label: 'LIVE', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function CommandFeed({
  tasks,
  workspaces,
  selectedWs,
  onSelectTask,
  onSelectWs,
  onAddTask,
}: {
  tasks: Task[]
  workspaces: Workspace[]
  selectedWs: Workspace | null
  onSelectTask: (task: Task) => void
  onSelectWs: (ws: Workspace) => void
  onAddTask: () => void
}) {
  const [input, setInput] = useState('')
  const [ripple, setRipple] = useState(false)
  const [recentCaptures, setRecentCaptures] = useState<string[]>([])
  const [actionizedDone, setActionizedDone] = useState<Set<string>>(new Set())

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

  const wsMap = Object.fromEntries(workspaces.map(w => [w.id, w]))

  const highImpact = tasks
    .filter(t => t.status === 'in_progress' || t.status === 'idea')
    .sort((a, b) => {
      const p: Record<string, number> = { high: 0, medium: 1, low: 2 }
      return p[a.priority] - p[b.priority]
    })
    .slice(0, 8)

  const blocked = tasks.filter(t => t.status === 'blocked')

  const displayWs = selectedWs
    ? workspaces.filter(w => w.id === selectedWs.id)
    : workspaces

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'transparent' }}>
      <div className="flex flex-col gap-0">

        {/* ── Quick Capture ───────────────────────────────────────────── */}
        <section
          className="px-5 py-4 relative"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
              <span className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} />
              <span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
            </div>
            <span className="text-[10px] font-[800] uppercase tracking-[0.2em]" style={{ color: '#00b4ff' }}>
              Action Hub
            </span>
            <span
              className="text-[8px] font-[700] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(0,180,255,0.08)', color: '#00b4ff', border: '1px solid rgba(0,180,255,0.18)' }}
            >
              ● WENDY AI IS ACTIVE
            </span>
            <span className="text-[9px] ml-auto" style={{ color: '#283044' }}>
              {tasks.length} tasks
            </span>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl relative"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,180,255,0.12)' }}
          >
            {ripple && (
              <div
                className="absolute inset-0 rounded-xl pointer-events-none"
                style={{ animation: 'inbox-ripple 0.5s ease-out forwards', border: '1px solid rgba(0,180,255,0.5)' }}
              />
            )}
            <span className="text-sm font-[700] shrink-0" style={{ color: '#00b4ff' }}>›</span>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && capture()}
              placeholder="Capture a thought, task, or question..."
              className="flex-1 bg-transparent outline-none text-xs"
              style={{ color: '#cbd5e1', caretColor: '#00b4ff' }}
            />
            {input && (
              <button
                onClick={capture}
                className="text-[9px] font-[700] px-2 py-1 rounded-md shrink-0"
                style={{ background: 'rgba(0,180,255,0.12)', color: '#00b4ff', border: '1px solid rgba(0,180,255,0.2)' }}
              >
                SAVE
              </button>
            )}
          </div>
          {recentCaptures.map((c, i) => (
            <div key={i} className="mt-1.5 text-[10px] px-3 py-1 rounded-lg" style={{ background: 'rgba(0,180,255,0.04)', color: '#334155' }}>
              ✓ {c}
            </div>
          ))}
        </section>

        {/* ── High Impact Tasks ───────────────────────────────────────── */}
        <section className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] font-[700] uppercase tracking-[0.2em]" style={{ color: '#334155' }}>
              High Impact
            </p>
            <button
              onClick={onAddTask}
              className="text-[9px] font-[700] px-2 py-1 rounded-md"
              style={{ background: 'rgba(0,180,255,0.08)', color: '#00b4ff', border: '1px solid rgba(0,180,255,0.15)' }}
            >
              + Add
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {highImpact.length === 0 && (
              <p className="text-xs px-1" style={{ color: '#1e293b' }}>No active tasks</p>
            )}
            {highImpact.map(task => {
              const ws = wsMap[task.workspace_id ?? '']
              const progress = taskProgress(task)
              const barColor = progress > 70 ? '#22c55e' : progress > 30 ? '#00b4ff' : '#f59e0b'
              const pri = PRIORITY_BADGE[task.priority]
              const ph = task.phase ? PHASE_BADGE[task.phase] : null
              return (
                <button
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className="text-left flex items-center gap-3 px-3 py-3 rounded-xl transition-all"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                >
                  {ws ? (
                    <BrandOrb name={ws.name} color={ws.color} />
                  ) : (
                    <div className="w-8 h-8 rounded-full shrink-0" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-[500] truncate leading-snug mb-1.5" style={{ color: '#cbd5e1' }}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      {pri && (
                        <span className="text-[8px] font-[800] px-1.5 py-0.5 rounded" style={{ background: pri.bg, color: pri.color }}>
                          {pri.label}
                        </span>
                      )}
                      {ph && (
                        <span className="text-[8px] font-[700] px-1.5 py-0.5 rounded" style={{ background: ph.bg, color: ph.color }}>
                          {ph.label}
                        </span>
                      )}
                      {ws && (
                        <span className="text-[8px] font-[600]" style={{ color: ws.color }}>{ws.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full" style={{ width: `${progress}%`, background: barColor }} />
                      </div>
                      <span className="text-[9px] font-[700] shrink-0" style={{ color: barColor }}>{progress}%</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Initiative Performance ──────────────────────────────────── */}
        <section className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] font-[700] uppercase tracking-[0.2em]" style={{ color: '#334155' }}>
              Initiative Performance Overview
            </p>
            {selectedWs && (
              <button
                onClick={() => onSelectWs(selectedWs)}
                className="text-[8px] font-[600]"
                style={{ color: '#475569' }}
              >
                Clear filter ×
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {displayWs.map(ws => {
              const pulse = healthPulse(ws)
              const isSelected = selectedWs?.id === ws.id
              return (
                <button
                  key={ws.id}
                  onClick={() => onSelectWs(ws)}
                  className="text-left rounded-xl p-3 transition-all"
                  style={{
                    background: isSelected ? `${ws.color}0e` : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isSelected ? ws.color + '40' : 'rgba(255,255,255,0.05)'}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: ws.color, boxShadow: `0 0 4px ${ws.color}` }}
                      />
                      <span className="text-[10px] font-[700] truncate" style={{ color: ws.color }}>{ws.name}</span>
                    </div>
                    {ws.active_count > 0 && (
                      <span className="text-[7px] font-[700]" style={{ color: '#22c55e' }}>● LIVE</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1 mb-2 text-center">
                    {[
                      { label: 'ACT', val: ws.active_count, color: '#00b4ff' },
                      { label: 'BLK', val: ws.blocked_count, color: '#f59e0b' },
                      { label: 'IDR', val: ws.idea_count, color: '#475569' },
                    ].map(({ label, val, color }) => (
                      <div key={label}>
                        <p className="text-sm font-[800]" style={{ color }}>{val}</p>
                        <p className="text-[7px] font-[600] uppercase tracking-wider" style={{ color: '#1e293b' }}>{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div className="flex-1">
                      <div className="h-0.5 rounded-full mb-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pulse}%`, background: ws.color, opacity: 0.7 }} />
                      </div>
                      <p className="text-[8px]" style={{ color: '#1e293b' }}>Velocity target {ws.active_count}/{ws.task_count}</p>
                    </div>
                    <Sparkline seed={ws.id} color={ws.color} />
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Actionized (Blocked) ─────────────────────────────────────── */}
        {blocked.length > 0 && (
          <section className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-[700] uppercase tracking-[0.2em]" style={{ color: '#f59e0b' }}>
                Actionized
              </p>
              <span className="text-[9px]" style={{ color: '#334155' }}>SORTED &gt;</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {blocked.map(task => {
                const ws = wsMap[task.workspace_id ?? '']
                const done = actionizedDone.has(task.id)
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.1)' }}
                  >
                    <button
                      onClick={() => {
                        setActionizedDone(prev => {
                          const next = new Set(prev)
                          if (next.has(task.id)) next.delete(task.id)
                          else next.add(task.id)
                          return next
                        })
                      }}
                      className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center transition-all"
                      style={{
                        background: done ? '#22c55e' : 'transparent',
                        border: `1.5px solid ${done ? '#22c55e' : 'rgba(245,158,11,0.4)'}`,
                      }}
                    >
                      {done && (
                        <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5L8 3" stroke="#04040a" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => onSelectTask(task)}
                      className="flex-1 text-left min-w-0"
                    >
                      <p className="text-xs truncate" style={{ color: done ? '#334155' : '#94a3b8', textDecoration: done ? 'line-through' : 'none' }}>
                        {task.title}
                      </p>
                      {ws && (
                        <p className="text-[9px] mt-0.5" style={{ color: ws.color }}>
                          {ws.name}
                        </p>
                      )}
                    </button>
                    <button
                      onClick={() => onSelectTask(task)}
                      className="shrink-0 w-5 h-5 flex items-center justify-center rounded transition-opacity hover:opacity-80"
                      style={{ color: '#334155' }}
                    >
                      ···
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Activity stream footer ───────────────────────────────────── */}
        <div
          className="px-5 py-2 mt-auto"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
        >
          <p className="text-[9px]" style={{ color: '#1e293b' }}>
            Activity Stream{' '}
            <span style={{ color: '#283044' }}>| BPE Command Center</span>{' '}
            <span style={{ color: '#1e293b' }}>| WENDY AI IS ACTIVE</span>
          </p>
        </div>

      </div>
    </div>
  )
}
