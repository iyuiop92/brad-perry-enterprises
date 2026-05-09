'use client'
import { useState, useRef, useEffect } from 'react'
import type { Task, Workspace, InboxItem } from '@/lib/types'

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

// ── Task card (left column) ─────────────────────────────────────────────────
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
  const blocked = task.status === 'blocked'
  const p1      = task.priority === 'high'
  const wsColor = workspace?.color ?? '#475569'
  const phase   = task.phase
  const pLabel  = phase ? (PHASE_ABBR[phase] ?? phase.slice(0, 4).toUpperCase()) : null
  const pColor  = phase ? (PHASE_COLOR[phase] ?? '#475569') : '#475569'

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        height: 40, padding: '0 8px', flexShrink: 0,
        background: blocked
          ? hov ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.04)'
          : hov ? 'rgba(0,180,255,0.04)' : 'transparent',
        borderLeft: `2px solid ${blocked ? 'rgba(245,158,11,0.55)' : p1 ? 'rgba(0,180,255,0.45)' : 'transparent'}`,
        borderBottom: '1px solid rgba(255,255,255,0.025)',
        transition: 'background 0.1s',
      }}
    >
      <div style={{
        width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
        background: blocked ? '#f59e0b' : '#00b4ff',
        boxShadow: blocked
          ? '0 0 6px rgba(245,158,11,0.9), 0 0 14px rgba(245,158,11,0.4)'
          : p1 ? '0 0 7px rgba(0,180,255,1), 0 0 14px rgba(0,180,255,0.5)'
          : '0 0 4px rgba(0,180,255,0.4)',
      }} />

      <span style={{
        fontSize: 9, fontWeight: 800, padding: '1px 4px', borderRadius: 3, flexShrink: 0,
        background: `${wsColor}18`, color: wsColor, border: `1px solid ${wsColor}28`, letterSpacing: '0.04em',
        textShadow: `0 0 8px ${wsColor}55`,
      }}>
        {workspace ? wsAbbr(workspace.name) : '··'}
      </span>

      <button
        onClick={onOpen}
        style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, minWidth: 0 }}
      >
        <span style={{
          fontSize: 12, display: 'block',
          fontWeight: blocked ? 600 : p1 ? 500 : 400,
          color: blocked ? '#fbbf24' : p1 ? '#cbd5e1' : '#64748b',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          textShadow: blocked ? '0 0 20px rgba(251,191,36,0.2)' : 'none',
        }}>
          {task.title}
        </span>
      </button>

      {pLabel && (
        <span style={{
          fontSize: 8, fontWeight: 700, padding: '1px 3px', borderRadius: 3, flexShrink: 0,
          color: pColor, border: `1px solid ${pColor}30`, letterSpacing: '0.04em',
        }}>
          {pLabel}
        </span>
      )}

      <span style={{ fontSize: 8, fontWeight: 700, color: p1 ? '#334155' : '#1e293b', flexShrink: 0, letterSpacing: '0.05em' }}>
        {task.priority === 'high' ? 'P1' : task.priority === 'medium' ? 'P2' : 'P3'}
      </span>

      <div style={{ display: 'flex', gap: 3, flexShrink: 0, opacity: hov ? 1 : 0.3, transition: 'opacity 0.15s' }}>
        {blocked && onActivate && (
          <button
            onClick={e => { e.stopPropagation(); onActivate() }}
            title="Move to Active"
            style={{
              width: 20, height: 20, borderRadius: 4, cursor: 'pointer', fontSize: 9,
              background: 'rgba(0,180,255,0.1)', border: '1px solid rgba(0,180,255,0.3)', color: '#00b4ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >▶</button>
        )}
        <button
          onClick={e => { e.stopPropagation(); onPostpone() }}
          title="Postpone to Ideas"
          style={{
            width: 20, height: 20, borderRadius: 4, cursor: 'pointer', fontSize: 9,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#475569',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >↙</button>
        <button
          onClick={e => { e.stopPropagation(); onDone() }}
          title="Mark Done"
          style={{
            width: 20, height: 20, borderRadius: 4, cursor: 'pointer', fontSize: 10,
            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✓</button>
      </div>
    </div>
  )
}

// ── Workspace tile (center grid) ────────────────────────────────────────────
function WorkspaceTile({
  ws, tasks, selected, onSelect, onOpenTask,
}: {
  ws: Workspace
  tasks: Task[]
  selected: boolean
  onSelect: () => void
  onOpenTask: (t: Task) => void
}) {
  const [hov, setHov] = useState(false)
  const wsTasks   = tasks.filter(t => t.workspace_id === ws.id && t.status !== 'done')
  const active    = wsTasks.filter(t => t.status === 'in_progress')
  const friction  = wsTasks.filter(t => t.status === 'blocked')
  const ideas     = wsTasks.filter(t => t.status === 'idea')
  const topTasks  = byPriority([...friction, ...active])
  const hasWork   = active.length > 0 || friction.length > 0

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'pointer',
        background: selected ? 'rgba(0,180,255,0.04)' : hov ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.25)',
        borderTop: `3px solid ${hasWork ? ws.color : ws.color + '33'}`,
        border: selected ? `1px solid rgba(0,180,255,0.18)` : '1px solid rgba(255,255,255,0.04)',
        boxShadow: selected ? `0 0 24px ${ws.color}1a, inset 0 0 40px rgba(0,180,255,0.015)` : 'none',
        transition: 'all 0.15s',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px 5px', flexShrink: 0 }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%', background: ws.color, flexShrink: 0,
          boxShadow: hasWork
            ? `0 0 8px ${ws.color}, 0 0 18px ${ws.color}55`
            : `0 0 4px ${ws.color}44`,
        }} />
        <span style={{
          flex: 1, fontSize: 11, fontWeight: 700, letterSpacing: '-0.01em',
          color: hasWork ? '#e2e8f0' : '#334155',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {ws.name}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {active.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 800, color: '#00b4ff', textShadow: '0 0 8px rgba(0,180,255,0.5)' }}>
              {active.length}
            </span>
          )}
          {friction.length > 0 && (
            <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', textShadow: '0 0 8px rgba(245,158,11,0.5)' }}>
              {friction.length}<span style={{ fontSize: 8, color: '#92400e', fontWeight: 600 }}>frx</span>
            </span>
          )}
          {ideas.length > 0 && (
            <span style={{ fontSize: 10, color: '#283044' }}>
              {ideas.length}<span style={{ fontSize: 8 }}> ↗</span>
            </span>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />

      {/* Task rows */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '3px 0' }}>
        {topTasks.length === 0 ? (
          <p style={{ fontSize: 10, color: '#1e293b', padding: '6px 10px' }}>
            {ideas.length > 0 ? `${ideas.length} idea${ideas.length > 1 ? 's' : ''} queued` : 'No active work'}
          </p>
        ) : (
          topTasks.map(t => {
            const isBlocked = t.status === 'blocked'
            const isP1      = t.priority === 'high'
            return (
              <button
                key={t.id}
                onClick={e => { e.stopPropagation(); onOpenTask(t) }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  width: '100%', padding: '3px 10px', height: 24,
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
                  flex: 1, fontSize: 10,
                  color: isBlocked ? '#fbbf24' : isP1 ? '#94a3b8' : '#475569',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontWeight: isBlocked ? 600 : isP1 ? 500 : 400,
                }}>
                  {t.title}
                </span>
                <span style={{ fontSize: 8, color: isP1 ? '#283044' : '#1e293b', flexShrink: 0, letterSpacing: '0.04em' }}>
                  {t.priority === 'high' ? 'P1' : t.priority === 'medium' ? 'P2' : 'P3'}
                </span>
              </button>
            )
          })
        )}
        {topTasks.length < active.length + friction.length && (
          <p style={{ fontSize: 9, color: '#1e293b', padding: '2px 10px 0', letterSpacing: '0.04em' }}>
            +{active.length + friction.length - topTasks.length} more
          </p>
        )}
      </div>
    </div>
  )
}

// ── Stat block (right column) ───────────────────────────────────────────────
function StatBlock({ n, label, color, glow }: { n: number; label: string; color: string; glow?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '6px 4px' }}>
      <p style={{
        fontSize: 28, fontWeight: 800, lineHeight: 1,
        color, textShadow: glow,
        fontFamily: 'var(--font-outfit)',
      }}>{n}</p>
      <p style={{ fontSize: 8, color: '#1e293b', letterSpacing: '0.1em', marginTop: 2, textTransform: 'uppercase' }}>{label}</p>
    </div>
  )
}

// ── Main export ─────────────────────────────────────────────────────────────
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
  const captureRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLocalTasks(propTasks)
    setDismissed(new Set())
  }, [propTasks])

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

  // Derive data
  const tasks   = localTasks.filter(t => !dismissed.has(t.id))
  const scope   = selectedWs ? tasks.filter(t => t.workspace_id === selectedWs.id) : tasks
  const friction  = byPriority(scope.filter(t => t.status === 'blocked'))
  const active    = byPriority(scope.filter(t => t.status === 'in_progress'))
  const ideas     = byPriority(scope.filter(t => t.status === 'idea'))
  const wsById    = Object.fromEntries(workspaces.map(w => [w.id, w]))
  const todayStr  = new Date().toDateString()
  const doneToday = tasks.filter(t => t.status === 'done' && new Date(t.updated_at).toDateString() === todayStr)

  const totalActive   = tasks.filter(t => t.status === 'in_progress').length
  const totalFriction = tasks.filter(t => t.status === 'blocked').length
  const totalIdeas    = tasks.filter(t => t.status === 'idea').length

  const tileRows = Math.max(1, Math.ceil(workspaces.length / 2))

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── LEFT: Task action list (28%) ── */}
      <div style={{
        width: '28%', minWidth: 220, display: 'flex', flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden',
      }}>
        {/* Quick capture */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          height: 36, padding: '0 10px', flexShrink: 0,
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
              fontSize: 11, color: captured ? '#22c55e' : '#94a3b8', caretColor: '#00b4ff',
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

        {/* Friction */}
        {friction.length > 0 && (
          <div style={{ flexShrink: 0 }}>
            <div style={{ padding: '5px 10px 2px', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: '#f59e0b',
                textShadow: '0 0 10px rgba(245,158,11,0.6), 0 0 22px rgba(245,158,11,0.25)',
              }}>FRICTION</span>
              <span style={{ fontSize: 9, color: '#78350f' }}>{friction.length}</span>
            </div>
            {friction.map(t => (
              <TaskCard
                key={t.id} task={t} workspace={wsById[t.workspace_id ?? '']}
                onOpen={() => onSelectTask(t)}
                onDone={() => handleDone(t)}
                onPostpone={() => handlePostpone(t)}
                onActivate={() => handleActivate(t)}
              />
            ))}
          </div>
        )}

        {/* Active + Ideas + Done Today (scrollable) */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {active.length > 0 && (
            <div style={{ padding: '5px 10px 2px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: '#334155' }}>ACTIVE</span>
              <span style={{ fontSize: 9, color: '#283044' }}>{active.length}</span>
            </div>
          )}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {active.map(t => (
              <TaskCard
                key={t.id} task={t} workspace={wsById[t.workspace_id ?? '']}
                onOpen={() => onSelectTask(t)}
                onDone={() => handleDone(t)}
                onPostpone={() => handlePostpone(t)}
              />
            ))}

            {ideas.length > 0 && (
              <>
                <div style={{ padding: '5px 10px 2px', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: '#283044' }}>IDEAS</span>
                  <span style={{ fontSize: 9, color: '#1e293b' }}>{ideas.length}</span>
                </div>
                {ideas.map(t => (
                  <TaskCard
                    key={t.id} task={t} workspace={wsById[t.workspace_id ?? '']}
                    onOpen={() => onSelectTask(t)}
                    onDone={() => handleDone(t)}
                    onPostpone={() => handlePostpone(t)}
                  />
                ))}
              </>
            )}

            {doneToday.length > 0 && (
              <>
                <div style={{ padding: '5px 10px 2px', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: '#1e293b' }}>DONE TODAY</span>
                  <span style={{ fontSize: 9, color: '#0f172a' }}>{doneToday.length}</span>
                </div>
                {doneToday.slice(0, 6).map(t => (
                  <button
                    key={t.id}
                    onClick={() => onSelectTask(t)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      height: 30, padding: '0 10px', width: '100%',
                      background: 'none', border: 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.015)',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.03)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 9, color: '#22c55e', flexShrink: 0, textShadow: '0 0 8px rgba(34,197,94,0.5)' }}>✓</span>
                    <span style={{ fontSize: 11, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.title}
                    </span>
                  </button>
                ))}
              </>
            )}

            {friction.length === 0 && active.length === 0 && ideas.length === 0 && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 11, color: '#1e293b' }}>Clean slate.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── CENTER: Workspace canvas (always fills space) ── */}
      <div style={{
        flex: 1, minWidth: 0,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: `repeat(${tileRows}, 1fr)`,
        gap: 1,
        background: 'rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}>
        {workspaces.map(ws => (
          <WorkspaceTile
            key={ws.id}
            ws={ws}
            tasks={tasks}
            selected={selectedWs?.id === ws.id}
            onSelect={() => onSelectWs(ws)}
            onOpenTask={onSelectTask}
          />
        ))}
        {workspaces.length % 2 !== 0 && (
          <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)' }} />
        )}
      </div>

      {/* ── RIGHT: Overview + Inbox (22%) ── */}
      <div style={{
        width: '22%', minWidth: 180, display: 'flex', flexDirection: 'column',
        borderLeft: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden',
      }}>
        {/* Stats grid */}
        <div style={{
          flexShrink: 0, padding: '10px 10px 8px',
          background: 'rgba(0,0,0,0.35)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          <p style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.15em', color: '#1e293b', marginBottom: 6 }}>OVERVIEW</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <StatBlock n={totalActive} label="Active" color="#00b4ff" glow="0 0 14px rgba(0,180,255,0.55)" />
            <StatBlock
              n={totalFriction} label="Friction"
              color={totalFriction > 0 ? '#f59e0b' : '#1e293b'}
              glow={totalFriction > 0 ? '0 0 14px rgba(245,158,11,0.6)' : undefined}
            />
            <StatBlock n={totalIdeas} label="Ideas" color="#334155" />
            <StatBlock
              n={doneToday.length} label="Done Today"
              color={doneToday.length > 0 ? '#22c55e' : '#1e293b'}
              glow={doneToday.length > 0 ? '0 0 12px rgba(34,197,94,0.45)' : undefined}
            />
          </div>
        </div>

        {/* Inbox */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '6px 12px 3px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: '#283044' }}>INBOX</span>
            {inbox.length > 0 && <span style={{ fontSize: 9, color: '#1e293b' }}>{inbox.length}</span>}
          </div>
          <div
            onClick={() => captureRef.current?.focus()}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              margin: '0 12px 6px', padding: '4px 8px', borderRadius: 5,
              background: 'rgba(0,180,255,0.04)', border: '1px solid rgba(0,180,255,0.08)',
              cursor: 'text', flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 10, color: '#00b4ff', fontWeight: 700 }}>›</span>
            <span style={{ fontSize: 10, color: '#1e293b' }}>Quick capture...</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {inbox.map(item => (
              <div key={item.id} style={{
                display: 'flex', gap: 5, padding: '4px 12px', alignItems: 'flex-start',
                borderBottom: '1px solid rgba(255,255,255,0.025)',
              }}>
                <span style={{ fontSize: 9, color: '#334155', flexShrink: 0, marginTop: 1 }}>·</span>
                <span style={{
                  fontSize: 10, color: '#334155', lineHeight: 1.35,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {item.content}
                </span>
              </div>
            ))}
            {inbox.length === 0 && (
              <p style={{ fontSize: 10, color: '#1e293b', padding: '4px 12px' }}>Nothing yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
