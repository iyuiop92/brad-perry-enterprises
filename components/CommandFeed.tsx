'use client'
import { useState, useRef, useEffect } from 'react'
import type { Task, Workspace, InboxItem } from '@/lib/types'

// ── Utilities ────────────────────────────────────────────────────────────────

async function patchTask(id: string, body: Record<string, unknown>) {
  await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {})
}

function wsAbbr(name: string) {
  const caps = name.replace(/[^A-Z]/g, '')
  return caps.length >= 2 ? caps.slice(0, 2) : name.slice(0, 2).toUpperCase()
}

function seededInt(seed: string, min: number, max: number): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x9e3779b9) | 0
  return min + Math.abs(h) % (max - min + 1)
}

function seededSparkline(seed: string, points = 10): number[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x9e3779b9) | 0
  return Array.from({ length: points }, (_, i) => {
    h = Math.imul(h ^ i, 0x9e3779b9) | 0
    return 20 + Math.abs(h) % 80
  })
}

function computeProgress(task: Task): number {
  if (task.deliverables?.length > 0) {
    const done = task.deliverables.filter(d => d.done).length
    return Math.round((done / task.deliverables.length) * 100)
  }
  return task.status === 'done' ? 100 : task.status === 'in_progress' ? 50 : 10
}

const P_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }
const PHASE_ABBR: Record<string, string> = {
  discovery: 'DISC', design: 'DSGN', build: 'BUILD', launch: 'LNCH', live: 'LIVE',
}
const PHASE_COLOR: Record<string, string> = {
  discovery: '#8b5cf6', design: '#3b82f6', build: '#00b4ff', launch: '#22c55e', live: '#10b981',
}

function byPriority(list: Task[]) {
  return [...list].sort((a, b) => (P_ORDER[a.priority] ?? 2) - (P_ORDER[b.priority] ?? 2))
}

function computeInsights(workspaces: Workspace[], tasks: Task[]): string[] {
  const blocked  = tasks.filter(t => t.status === 'blocked')
  const p1       = tasks.filter(t => t.priority === 'high' && t.status !== 'done')
  const mostActive = [...workspaces].sort((a, b) => b.active_count - a.active_count)[0]
  const out: string[] = []
  if (blocked.length) out.push(`${blocked.length} task${blocked.length > 1 ? 's' : ''} need unblocking`)
  if (p1.length)      out.push(`${p1.length} P1 item${p1.length > 1 ? 's' : ''} in flight`)
  if (mostActive?.active_count > 0) out.push(`${mostActive.name} leads momentum`)
  if (!out.length)    out.push('Portfolio operating cleanly')
  return out.slice(0, 3)
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────
function Sparkline({ seed, color, w = 72, h = 22 }: { seed: string; color: string; w?: number; h?: number }) {
  const vals = seededSparkline(seed)
  const min  = Math.min(...vals), max = Math.max(...vals)
  const rng  = max - min || 1
  const pts  = vals.map((v, i) => [
    (i / (vals.length - 1)) * w,
    h - ((v - min) / rng) * (h - 2) - 1,
  ])
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = [...pts, [w, h], [0, h]].map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + 'Z'
  const gid  = `sg${seed.replace(/[^a-z0-9]/gi, '').slice(-8)}`
  return (
    <svg width={w} height={h} style={{ display: 'block', flexShrink: 0 }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.85" />
    </svg>
  )
}

// ── Task card (left column) ──────────────────────────────────────────────
function TaskCard({
  task, workspace, onOpen, onDone, onPostpone, onActivate,
}: {
  task: Task
  workspace?: Workspace
  onOpen: () => void
  onDone: () => void
  onPostpone: () => void
  onActivate?: () => void
}) {
  const [hov, setHov] = useState(false)
  const blocked  = task.status === 'blocked'
  const p1       = task.priority === 'high'
  const wsColor  = workspace?.color ?? '#8899aa'
  const phase    = task.phase
  const pLabel   = phase ? (PHASE_ABBR[phase] ?? phase.slice(0, 4).toUpperCase()) : null
  const pColor   = phase ? (PHASE_COLOR[phase] ?? '#8899aa') : '#8899aa'
  const progress = computeProgress(task)
  const aiScore  = seededInt(task.id, 72, 99)
  const barColor = blocked ? '#f59e0b' : '#00b4ff'
  const abbr     = workspace ? wsAbbr(workspace.name) : '··'

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative', flexShrink: 0,
        borderLeft: `2px solid ${blocked ? 'rgba(245,158,11,0.55)' : p1 ? 'rgba(0,180,255,0.45)' : 'rgba(255,255,255,0.06)'}`,
        borderBottom: '1px solid rgba(255,255,255,0.03)',
        background: blocked
          ? hov ? 'rgba(245,158,11,0.07)' : 'rgba(245,158,11,0.04)'
          : hov ? 'rgba(0,180,255,0.04)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {/* Progress strip at bottom */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'rgba(255,255,255,0.04)' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: barColor, opacity: 0.55, transition: 'width 0.6s' }} />
      </div>

      {/* Card body */}
      <div style={{ padding: '8px 10px 10px', cursor: 'pointer' }} onClick={onOpen}>
        {/* Row 1: dot + ws chip + title + progress % */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: blocked ? '#f59e0b' : '#00b4ff',
            boxShadow: blocked
              ? '0 0 6px rgba(245,158,11,0.9), 0 0 14px rgba(245,158,11,0.4)'
              : p1 ? '0 0 7px rgba(0,180,255,1), 0 0 14px rgba(0,180,255,0.5)'
              : '0 0 4px rgba(0,180,255,0.4)',
          }} />
          <span style={{
            fontSize: 9, fontWeight: 800, padding: '1px 4px', borderRadius: 3, flexShrink: 0,
            background: `${wsColor}18`, color: wsColor, border: `1px solid ${wsColor}28`,
            letterSpacing: '0.04em', textShadow: `0 0 8px ${wsColor}55`,
          }}>{abbr}</span>
          <span style={{
            flex: 1, fontSize: 12, fontWeight: blocked ? 600 : p1 ? 500 : 400,
            color: blocked ? '#fbbf24' : '#ffffff',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{task.title}</span>
          <span style={{
            fontSize: 10, fontWeight: 800, color: barColor, flexShrink: 0,
            textShadow: blocked ? '0 0 8px rgba(245,158,11,0.4)' : '0 0 8px rgba(0,180,255,0.4)',
          }}>{progress}%</span>
        </div>

        {/* Row 2: badges + AI score + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 3, flexShrink: 0,
            color: p1 ? '#00b4ff' : blocked ? '#f59e0b' : '#8899aa',
            background: p1 ? 'rgba(0,180,255,0.1)' : blocked ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${p1 ? 'rgba(0,180,255,0.2)' : blocked ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.1)'}`,
            letterSpacing: '0.05em',
          }}>
            {task.priority === 'high' ? 'P1' : task.priority === 'medium' ? 'P2' : 'P3'}
          </span>
          {pLabel && (
            <span style={{
              fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3, flexShrink: 0,
              color: pColor, border: `1px solid ${pColor}28`, letterSpacing: '0.04em',
            }}>{pLabel}</span>
          )}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 8, color: '#8899aa', fontWeight: 600, letterSpacing: '0.04em' }}>
            AI <span style={{
              color: aiScore >= 90 ? '#22c55e' : '#00b4ff',
              fontWeight: 800,
              textShadow: aiScore >= 90 ? '0 0 8px rgba(34,197,94,0.4)' : '0 0 6px rgba(0,180,255,0.3)',
            }}>{aiScore}</span>
          </span>
          <div
            style={{ display: 'flex', gap: 3, opacity: hov ? 1 : 0, transition: 'opacity 0.15s', marginLeft: 6 }}
            onClick={e => e.stopPropagation()}
          >
            {blocked && onActivate && (
              <button onClick={onActivate} title="Activate" style={{
                width: 18, height: 18, borderRadius: 3, cursor: 'pointer', fontSize: 8, border: 'none',
                background: 'rgba(0,180,255,0.12)', color: '#00b4ff',
                boxShadow: '0 0 6px rgba(0,180,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>▶</button>
            )}
            <button onClick={onPostpone} title="Postpone to Ideas" style={{
              width: 18, height: 18, borderRadius: 3, cursor: 'pointer', fontSize: 8, border: 'none',
              background: 'rgba(255,255,255,0.08)', color: '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>↙</button>
            <button onClick={onDone} title="Mark Done" style={{
              width: 18, height: 18, borderRadius: 3, cursor: 'pointer', fontSize: 9, border: 'none',
              background: 'rgba(34,197,94,0.1)', color: '#22c55e',
              boxShadow: '0 0 6px rgba(34,197,94,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✓</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Workspace tile (center grid) ──────────────────────────────────────────
function WorkspaceTile({
  ws, tasks, selected, focused, onSelect, onFocus, onOpenTask,
}: {
  ws: Workspace
  tasks: Task[]
  selected: boolean
  focused: boolean
  onSelect: () => void
  onFocus: () => void
  onOpenTask: (t: Task) => void
}) {
  const [hov, setHov] = useState(false)
  const wsTasks  = tasks.filter(t => t.workspace_id === ws.id && t.status !== 'done')
  const active   = wsTasks.filter(t => t.status === 'in_progress')
  const friction = wsTasks.filter(t => t.status === 'blocked')
  const ideas    = wsTasks.filter(t => t.status === 'idea')
  const total    = wsTasks.length
  const velocity = total > 0 ? Math.round(((active.length) / total) * 100) : 0
  const aiScore  = seededInt(ws.id, 70, 98)
  const hasWork  = active.length > 0 || friction.length > 0
  const topTasks = byPriority([...friction, ...active, ...ideas])
  const sparkColor = friction.length > 0 ? '#f59e0b' : hasWork ? ws.color : '#8899aa'

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'pointer',
        background: selected ? 'rgba(0,180,255,0.04)' : hov ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.22)',
        borderTop: `3px solid ${hasWork ? ws.color : ws.color + '33'}`,
        border: `1px solid ${selected ? 'rgba(0,180,255,0.2)' : 'rgba(255,255,255,0.04)'}`,
        boxShadow: selected ? `0 0 24px ${ws.color}1a` : 'none',
        transition: 'all 0.15s',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px 3px', flexShrink: 0 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%', background: ws.color, flexShrink: 0,
          boxShadow: hasWork ? `0 0 7px ${ws.color}, 0 0 14px ${ws.color}55` : `0 0 3px ${ws.color}44`,
        }} />
        <span style={{
          flex: 1, fontSize: 10, fontWeight: 700, letterSpacing: '-0.01em',
          color: '#ffffff',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{ws.name}</span>
        {hov && (
          <button
            onClick={e => { e.stopPropagation(); onFocus() }}
            title={focused ? 'Exit focus' : 'Focus mode'}
            style={{
              flexShrink: 0, width: 16, height: 16, borderRadius: 3, border: 'none',
              cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: focused ? 'rgba(0,180,255,0.25)' : 'rgba(255,255,255,0.08)',
              color: focused ? '#00b4ff' : '#8899aa',
              marginRight: 4,
            }}
          >⊙</button>
        )}
        <Sparkline seed={ws.id} color={sparkColor} w={48} h={18} />
      </div>

      {/* Stats bar */}
      <div style={{
        display: 'flex', flexShrink: 0,
        borderTop: '1px solid rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        {([
          { label: 'ACTIVE',   val: active.length,   color: active.length > 0 ? '#00b4ff' : '#8899aa',   glow: active.length > 0 ? '0 0 8px rgba(0,180,255,0.4)' : 'none' },
          { label: 'FRICTION', val: friction.length, color: friction.length > 0 ? '#f59e0b' : '#8899aa', glow: friction.length > 0 ? '0 0 8px rgba(245,158,11,0.4)' : 'none' },
          { label: 'IDEAS',    val: ideas.length,    color: ideas.length > 0 ? '#ffffff' : '#8899aa',     glow: 'none' },
          { label: 'VELOCITY', val: `${velocity}%`,  color: velocity > 50 ? '#22c55e' : velocity > 20 ? '#00b4ff' : '#8899aa', glow: velocity > 50 ? '0 0 8px rgba(34,197,94,0.3)' : 'none' },
        ] as { label: string; val: string | number; color: string; glow: string }[]).map(({ label, val, color, glow }, i, arr) => (
          <div key={label} style={{
            flex: 1, textAlign: 'center', padding: '4px 2px',
            borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
          }}>
            <p style={{ fontSize: 11, fontWeight: 800, color, textShadow: glow, lineHeight: 1 }}>{val}</p>
            <p style={{ fontSize: 6, color: '#8899aa', letterSpacing: '0.08em', marginTop: 1 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '2px 0' }}>
        {topTasks.length === 0 ? (
          <p style={{ fontSize: 10, color: '#8899aa', padding: '6px 10px' }}>No work queued</p>
        ) : topTasks.map(t => {
          const isBlocked = t.status === 'blocked'
          const isP1      = t.priority === 'high'
          return (
            <button
              key={t.id}
              onClick={e => { e.stopPropagation(); onOpenTask(t) }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                padding: '2px 8px', height: 20,
                background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.08s',
              }}
            >
              <div style={{
                width: 4, height: 4, borderRadius: '50%', flexShrink: 0,
                background: isBlocked ? '#f59e0b' : '#00b4ff',
                boxShadow: isBlocked ? '0 0 5px rgba(245,158,11,0.7)' : isP1 ? '0 0 5px rgba(0,180,255,0.7)' : 'none',
              }} />
              <span style={{
                flex: 1, fontSize: 9, fontWeight: isBlocked ? 600 : 400,
                color: isBlocked ? '#fbbf24' : '#ffffff',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{t.title}</span>
              <span style={{ fontSize: 7, color: '#8899aa', flexShrink: 0, letterSpacing: '0.04em' }}>
                {t.priority === 'high' ? 'P1' : t.priority === 'medium' ? 'P2' : 'P3'}
              </span>
            </button>
          )
        })}
      </div>

      {/* AI score footer */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
        padding: '2px 8px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(0,0,0,0.2)',
      }}>
        <span style={{ fontSize: 6, color: '#8899aa', letterSpacing: '0.08em', flexShrink: 0 }}>AI SCORE</span>
        <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
          <div style={{
            height: '100%', width: `${aiScore}%`, borderRadius: 1,
            background: aiScore >= 90 ? '#22c55e' : '#00b4ff',
            boxShadow: aiScore >= 90 ? '0 0 4px rgba(34,197,94,0.6)' : '0 0 4px rgba(0,180,255,0.5)',
          }} />
        </div>
        <span style={{
          fontSize: 10, fontWeight: 800, flexShrink: 0,
          color: aiScore >= 90 ? '#22c55e' : '#00b4ff',
          textShadow: aiScore >= 90 ? '0 0 8px rgba(34,197,94,0.5)' : '0 0 8px rgba(0,180,255,0.4)',
        }}>{aiScore}</span>
      </div>
    </div>
  )
}

// ── Main export ──────────────────────────────────────────────────────────────
export default function CommandFeed({
  tasks: propTasks,
  workspaces,
  selectedWs,
  onSelectTask,
  onSelectWs,
  onAddTask: _onAddTask,
  onRefresh,
}: {
  tasks: Task[]
  workspaces: Workspace[]
  selectedWs: Workspace | null
  onSelectTask: (t: Task) => void
  onSelectWs: (w: Workspace) => void
  onAddTask: () => void
  onRefresh: () => void
}) {
  const [dismissed, setDismissed]   = useState<Set<string>>(new Set())
  const [localTasks, setLocalTasks] = useState<Task[]>(propTasks)
  const [capture, setCapture]       = useState('')
  const [capturing, setCapturing]   = useState(false)
  const [captured, setCaptured]     = useState(false)
  const [inbox, setInbox]           = useState<InboxItem[]>([])
  const [focusWsId, setFocusWsId]   = useState<string | null>(null)
  const captureRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setLocalTasks(propTasks); setDismissed(new Set()) }, [propTasks])
  useEffect(() => {
    fetch('/api/inbox').then(r => r.ok ? r.json() : []).then(setInbox).catch(() => {})
  }, [])

  async function handleDone(task: Task) {
    setDismissed(prev => new Set([...prev, task.id]))
    await patchTask(task.id, { status: 'done' })
    onRefresh()
  }
  async function handlePostpone(task: Task) {
    setDismissed(prev => new Set([...prev, task.id]))
    await patchTask(task.id, { status: 'idea' })
    onRefresh()
  }
  async function handleActivate(task: Task) {
    setLocalTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'in_progress' as const } : t))
    await patchTask(task.id, { status: 'in_progress' })
    onRefresh()
  }
  async function handleCapture() {
    const text = capture.trim()
    if (!text || capturing) return
    setCapturing(true)
    try {
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      if (res.ok) {
        const item = await res.json()
        setInbox(prev => [item, ...prev])
        setCapture('')
        setCaptured(true)
        setTimeout(() => setCaptured(false), 1800)
      }
    } finally {
      setCapturing(false)
    }
  }

  const tasks      = localTasks.filter(t => !dismissed.has(t.id))
  const scope      = selectedWs ? tasks.filter(t => t.workspace_id === selectedWs.id) : tasks
  const friction   = byPriority(scope.filter(t => t.status === 'blocked'))
  const active     = byPriority(scope.filter(t => t.status === 'in_progress'))
  const ideas      = byPriority(scope.filter(t => t.status === 'idea'))
  const wsById     = Object.fromEntries(workspaces.map(w => [w.id, w]))
  const todayStr   = new Date().toDateString()
  const doneToday  = tasks.filter(t => t.status === 'done' && new Date(t.updated_at).toDateString() === todayStr)
  const totalActive   = tasks.filter(t => t.status === 'in_progress').length
  const totalFriction = tasks.filter(t => t.status === 'blocked').length
  const totalIdeas    = tasks.filter(t => t.status === 'idea').length
  const insights   = computeInsights(workspaces, tasks)
  const tileRows   = Math.max(1, Math.ceil(workspaces.length / 4))

  const recent = [...tasks].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 10)
  const ticker = recent.map(t => {
    const abbr = t.workspace_id ? wsAbbr(wsById[t.workspace_id]?.name ?? '··') : '··'
    return `[ ${abbr} ] ${t.title} — ${t.status.replace('_', ' ')}`
  }).join('   ·   ')

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── LEFT: Task list + ticker (30%) ── */}
      <div style={{
        width: '18%', minWidth: 180, display: 'flex', flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden',
      }}>
        {/* Quick capture bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          height: 38, padding: '0 12px', flexShrink: 0,
          background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(0,180,255,0.08)',
        }}>
          <span style={{ color: '#00b4ff', fontWeight: 800, fontSize: 15, textShadow: '0 0 10px rgba(0,180,255,0.7)' }}>›</span>
          <input
            ref={captureRef}
            value={capture}
            onChange={e => setCapture(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCapture()}
            placeholder={captured ? '✓ Captured' : 'Capture idea or task...'}
            disabled={capturing}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 12, color: captured ? '#22c55e' : '#ffffff', caretColor: '#00b4ff',
            }}
          />
          {capture.trim() && (
            <button onClick={handleCapture} style={{
              fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 4,
              background: 'rgba(0,180,255,0.12)', color: '#00b4ff',
              border: '1px solid rgba(0,180,255,0.3)', cursor: 'pointer',
              boxShadow: '0 0 8px rgba(0,180,255,0.2)',
            }}>GO</button>
          )}
        </div>

        {/* Scrollable task cards */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {friction.length > 0 && (
            <>
              <div style={{ padding: '6px 10px 3px', display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: '#f59e0b', textShadow: '0 0 10px rgba(245,158,11,0.6)' }}>FRICTION</span>
                <span style={{ fontSize: 9, color: '#f59e0b' }}>{friction.length}</span>
              </div>
              {friction.map(t => (
                <TaskCard key={t.id} task={t} workspace={wsById[t.workspace_id ?? '']}
                  onOpen={() => onSelectTask(t)} onDone={() => handleDone(t)}
                  onPostpone={() => handlePostpone(t)} onActivate={() => handleActivate(t)} />
              ))}
            </>
          )}

          {active.length > 0 && (
            <>
              <div style={{ padding: '6px 10px 3px', display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: '#00b4ff' }}>ACTIVE</span>
                <span style={{ fontSize: 9, color: '#00b4ff' }}>{active.length}</span>
              </div>
              {active.map(t => (
                <TaskCard key={t.id} task={t} workspace={wsById[t.workspace_id ?? '']}
                  onOpen={() => onSelectTask(t)} onDone={() => handleDone(t)}
                  onPostpone={() => handlePostpone(t)} />
              ))}
            </>
          )}

          {ideas.length > 0 && (
            <>
              <div style={{ padding: '6px 10px 3px', display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: '#ffffff' }}>IDEAS</span>
                <span style={{ fontSize: 9, color: '#ffffff' }}>{ideas.length}</span>
              </div>
              {ideas.map(t => (
                <TaskCard key={t.id} task={t} workspace={wsById[t.workspace_id ?? '']}
                  onOpen={() => onSelectTask(t)} onDone={() => handleDone(t)}
                  onPostpone={() => handlePostpone(t)} />
              ))}
            </>
          )}

          {doneToday.length > 0 && (
            <>
              <div style={{ padding: '6px 10px 3px', display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: '#22c55e' }}>DONE TODAY</span>
                <span style={{ fontSize: 9, color: '#22c55e' }}>{doneToday.length}</span>
              </div>
              {doneToday.slice(0, 6).map(t => (
                <button key={t.id} onClick={() => onSelectTask(t)}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.03)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px',
                    width: '100%', background: 'transparent', border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.02)',
                    cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
                  }}
                >
                  <span style={{ fontSize: 9, color: '#22c55e', flexShrink: 0, textShadow: '0 0 8px rgba(34,197,94,0.5)' }}>✓</span>
                  <span style={{ fontSize: 11, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                </button>
              ))}
            </>
          )}

          {friction.length === 0 && active.length === 0 && ideas.length === 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, color: '#8899aa' }}>Clean slate.</span>
            </div>
          )}
        </div>

        {/* Activity ticker */}
        {ticker && (
          <div style={{
            flexShrink: 0, height: 22, overflow: 'hidden',
            background: 'rgba(0,0,0,0.5)', borderTop: '1px solid rgba(0,180,255,0.06)',
          }}>
            <style>{`@keyframes bpe-ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
            <div style={{
              display: 'inline-flex', whiteSpace: 'nowrap',
              animation: 'bpe-ticker 50s linear infinite', padding: '4px 0',
            }}>
              <span style={{ fontSize: 9, color: '#8899aa', paddingRight: 60 }}>{ticker}</span>
              <span style={{ fontSize: 9, color: '#8899aa', paddingRight: 60 }}>{ticker}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── CENTER: Workspace tile grid ── */}
      {focusWsId ? (() => {
        const fw = workspaces.find(w => w.id === focusWsId)
        if (!fw) return null
        return (
          <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 12px', height: 26,
              background: `${fw.color}18`, borderBottom: `1px solid ${fw.color}33`,
            }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: fw.color }}>
                ⊙ FOCUS — {fw.name.toUpperCase()}
              </span>
              <button
                onClick={() => setFocusWsId(null)}
                style={{
                  fontSize: 9, fontWeight: 800, padding: '1px 8px', borderRadius: 4,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ffffff', cursor: 'pointer', letterSpacing: '0.06em',
                }}
              >✕ EXIT</button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <WorkspaceTile ws={fw} tasks={tasks}
                selected focused
                onSelect={() => {}} onFocus={() => setFocusWsId(null)} onOpenTask={onSelectTask} />
            </div>
          </div>
        )
      })() : (
        <div style={{
          flex: 1, minWidth: 0, height: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridTemplateRows: `repeat(${tileRows}, 1fr)`,
          gap: 1, background: 'rgba(0,0,0,0.3)', overflow: 'hidden',
        }}>
          {workspaces.map(ws => (
            <WorkspaceTile key={ws.id} ws={ws} tasks={tasks}
              selected={selectedWs?.id === ws.id}
              focused={focusWsId === ws.id}
              onSelect={() => onSelectWs(ws)}
              onFocus={() => { setFocusWsId(ws.id); onSelectWs(ws) }}
              onOpenTask={onSelectTask} />
          ))}
          {Array.from({ length: (4 - (workspaces.length % 4)) % 4 }).map((_, i) => (
            <div key={`filler-${i}`} style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.02)' }} />
          ))}
        </div>
      )}

      {/* ── RIGHT: Stats + Focus + Health + Inbox (20%) ── */}
      <div style={{
        width: '13%', minWidth: 150, display: 'flex', flexDirection: 'column',
        borderLeft: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden',
      }}>

        {/* Compact stats row */}
        <div style={{
          flexShrink: 0, display: 'flex', gap: 3, padding: '7px 8px',
          background: 'rgba(0,0,0,0.35)', borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          {([
            { n: totalActive,      label: 'ACT', color: '#00b4ff',                                       glow: '0 0 10px rgba(0,180,255,0.5)' },
            { n: totalFriction,    label: 'FRI', color: totalFriction > 0 ? '#f59e0b' : '#8899aa',      glow: totalFriction > 0 ? '0 0 10px rgba(245,158,11,0.5)' : 'none' },
            { n: totalIdeas,       label: 'IDR', color: '#ffffff',                                        glow: 'none' },
            { n: doneToday.length, label: 'DNE', color: doneToday.length > 0 ? '#22c55e' : '#8899aa',   glow: doneToday.length > 0 ? '0 0 10px rgba(34,197,94,0.4)' : 'none' },
          ] as { n: number; label: string; color: string; glow: string }[]).map(({ n, label, color, glow }) => (
            <div key={label} style={{ flex: 1, textAlign: 'center', padding: '4px 2px', background: 'rgba(255,255,255,0.02)', borderRadius: 4 }}>
              <p style={{ fontSize: 18, fontWeight: 800, lineHeight: 1, color, textShadow: glow, fontFamily: 'var(--font-outfit)' }}>{n}</p>
              <p style={{ fontSize: 7, color: '#8899aa', letterSpacing: '0.08em', marginTop: 2 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Focus Now — top priority task with quick actions */}
        {(() => {
          const focusTask = [...friction, ...active][0]
          if (!focusTask) return null
          const ws = wsById[focusTask.workspace_id ?? '']
          const isBlocked = focusTask.status === 'blocked'
          return (
            <div style={{ flexShrink: 0, padding: '7px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <p style={{ fontSize: 7, fontWeight: 800, letterSpacing: '0.14em', color: '#8899aa', marginBottom: 5 }}>FOCUS NOW</p>
              <div
                onClick={() => onSelectTask(focusTask)}
                style={{
                  padding: '7px 8px', borderRadius: 5, cursor: 'pointer',
                  background: isBlocked ? 'rgba(245,158,11,0.06)' : 'rgba(0,180,255,0.06)',
                  border: `1px solid ${isBlocked ? 'rgba(245,158,11,0.2)' : 'rgba(0,180,255,0.18)'}`,
                }}
              >
                {ws && <p style={{ fontSize: 8, color: ws.color, fontWeight: 800, marginBottom: 3, letterSpacing: '0.04em' }}>{ws.name}</p>}
                <p style={{ fontSize: 11, color: isBlocked ? '#fbbf24' : '#ffffff', fontWeight: 600, lineHeight: 1.35, marginBottom: 6 }}>{focusTask.title}</p>
                <div style={{ display: 'flex', gap: 3 }} onClick={e => e.stopPropagation()}>
                  {isBlocked && (
                    <button onClick={() => handleActivate(focusTask)} style={{
                      flex: 1, fontSize: 8, padding: '3px 0', borderRadius: 3, border: 'none', cursor: 'pointer',
                      background: 'rgba(0,180,255,0.12)', color: '#00b4ff',
                    }}>▶ Activate</button>
                  )}
                  <button onClick={() => handleDone(focusTask)} style={{
                    flex: 1, fontSize: 8, padding: '3px 0', borderRadius: 3, border: 'none', cursor: 'pointer',
                    background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                  }}>✓ Done</button>
                  <button onClick={() => handlePostpone(focusTask)} style={{
                    flex: 1, fontSize: 8, padding: '3px 0', borderRadius: 3, border: 'none', cursor: 'pointer',
                    background: 'rgba(255,255,255,0.06)', color: '#ffffff',
                  }}>↙ Later</button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Workspace health */}
        <div style={{ flexShrink: 0, padding: '7px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <p style={{ fontSize: 7, fontWeight: 800, letterSpacing: '0.14em', color: '#8899aa', marginBottom: 5 }}>WORKSPACES</p>
          {workspaces.map(ws => {
            const wsTasks    = tasks.filter(t => t.workspace_id === ws.id && t.status !== 'done')
            const wsActive   = wsTasks.filter(t => t.status === 'in_progress').length
            const wsFriction = wsTasks.filter(t => t.status === 'blocked').length
            return (
              <div key={ws.id} onClick={() => onSelectWs(ws)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', cursor: 'pointer',
              }}>
                <div style={{
                  width: 5, height: 5, borderRadius: '50%', background: ws.color, flexShrink: 0,
                  boxShadow: wsActive > 0 ? `0 0 5px ${ws.color}` : 'none',
                }} />
                <span style={{ flex: 1, fontSize: 9, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
                {wsActive > 0 && <span style={{ fontSize: 8, fontWeight: 700, color: '#00b4ff' }}>{wsActive}</span>}
                {wsFriction > 0 && <span style={{ fontSize: 8, fontWeight: 700, color: '#f59e0b' }}>⚠{wsFriction}</span>}
              </div>
            )
          })}
        </div>

        {/* Inbox */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '6px 10px 3px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: '#ffffff' }}>INBOX</span>
            {inbox.length > 0 && <span style={{ fontSize: 9, color: '#ffffff' }}>{inbox.length}</span>}
          </div>
          <div
            onClick={() => captureRef.current?.focus()}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              margin: '0 10px 5px', padding: '4px 7px', borderRadius: 5, cursor: 'text', flexShrink: 0,
              background: 'rgba(0,180,255,0.04)', border: '1px solid rgba(0,180,255,0.08)',
            }}
          >
            <span style={{ fontSize: 10, color: '#00b4ff', fontWeight: 700 }}>›</span>
            <span style={{ fontSize: 10, color: '#8899aa' }}>Quick capture...</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {inbox.map(item => (
              <div key={item.id} style={{ display: 'flex', gap: 5, padding: '4px 10px', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.025)' }}>
                <span style={{ fontSize: 9, color: '#8899aa', flexShrink: 0, marginTop: 1 }}>·</span>
                <span style={{ fontSize: 10, color: '#ffffff', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.content}
                </span>
              </div>
            ))}
            {inbox.length === 0 && (
              <p style={{ fontSize: 10, color: '#8899aa', padding: '4px 10px' }}>Nothing yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
