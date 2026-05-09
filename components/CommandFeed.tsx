'use client'
import { useState, useRef, useEffect } from 'react'
import type { Task, Workspace, InboxItem } from '@/lib/types'

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

function byPriority(tasks: Task[]) {
  return [...tasks].sort((a, b) => (P_ORDER[a.priority] ?? 2) - (P_ORDER[b.priority] ?? 2))
}

function TaskRow({
  task,
  workspace,
  onClick,
}: {
  task: Task
  workspace?: Workspace
  onClick: () => void
}) {
  const [hov, setHov] = useState(false)
  const blocked = task.status === 'blocked'
  const p1 = task.priority === 'high'
  const abbr = workspace ? wsAbbr(workspace.name) : '··'
  const wsColor = workspace?.color ?? '#475569'
  const phase = task.phase
  const phaseLabel = phase ? (PHASE_ABBR[phase] ?? phase.slice(0, 4).toUpperCase()) : null
  const phaseColor = phase ? (PHASE_COLOR[phase] ?? '#475569') : '#475569'

  const leftBorder = blocked
    ? 'rgba(245,158,11,0.55)'
    : p1
    ? 'rgba(0,180,255,0.4)'
    : 'transparent'

  const bg = blocked
    ? hov ? 'rgba(245,158,11,0.07)' : 'rgba(245,158,11,0.03)'
    : hov ? 'rgba(0,180,255,0.04)' : 'transparent'

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', height: 32, padding: '0 12px',
        background: bg, border: 'none',
        borderLeft: `2px solid ${leftBorder}`,
        borderBottom: '1px solid rgba(255,255,255,0.025)',
        cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.1s',
        flexShrink: 0,
      }}
    >
      <div style={{
        width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
        background: blocked ? '#f59e0b' : '#00b4ff',
        boxShadow: blocked
          ? '0 0 6px rgba(245,158,11,0.8), 0 0 14px rgba(245,158,11,0.35)'
          : p1
          ? '0 0 7px rgba(0,180,255,0.9), 0 0 14px rgba(0,180,255,0.4)'
          : '0 0 4px rgba(0,180,255,0.35)',
      }} />

      <span style={{
        fontSize: 9, fontWeight: 800, padding: '1px 4px', borderRadius: 3,
        flexShrink: 0, letterSpacing: '0.04em',
        background: `${wsColor}16`,
        color: wsColor,
        border: `1px solid ${wsColor}28`,
        textShadow: `0 0 8px ${wsColor}55`,
      }}>
        {abbr}
      </span>

      <span style={{
        flex: 1, fontSize: 12, fontWeight: blocked ? 600 : p1 ? 500 : 400,
        color: blocked ? '#fbbf24' : p1 ? '#cbd5e1' : '#64748b',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textShadow: blocked ? '0 0 20px rgba(251,191,36,0.18)' : 'none',
      }}>
        {task.title}
      </span>

      <span style={{
        fontSize: 9, fontWeight: 700, flexShrink: 0, letterSpacing: '0.06em',
        color: blocked ? '#92400e' : p1 ? '#334155' : '#1e293b',
      }}>
        {task.priority === 'high' ? 'P1' : task.priority === 'medium' ? 'P2' : 'P3'}
      </span>

      {phaseLabel && (
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
          flexShrink: 0, letterSpacing: '0.04em',
          color: phaseColor, border: `1px solid ${phaseColor}30`,
        }}>
          {phaseLabel}
        </span>
      )}

      <span style={{ fontSize: 11, color: '#1e293b', flexShrink: 0, marginLeft: 2 }}>›</span>
    </button>
  )
}

function SectionLabel({
  label, count, color, glow,
}: {
  label: string
  count: number
  color: string
  glow?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px 3px', flexShrink: 0 }}>
      <span style={{
        fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase',
        color, textShadow: glow,
      }}>
        {label}
      </span>
      <span style={{ fontSize: 9, color: '#283044', fontWeight: 600 }}>{count}</span>
    </div>
  )
}

function WorkspaceRow({
  ws, active, friction, selected, onClick,
}: {
  ws: Workspace
  active: number
  friction: number
  selected: boolean
  onClick: () => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        width: '100%', height: 30, padding: '0 12px',
        background: selected ? 'rgba(0,180,255,0.06)' : hov ? 'rgba(255,255,255,0.02)' : 'transparent',
        border: 'none',
        borderLeft: `2px solid ${selected ? '#00b4ff' : 'transparent'}`,
        cursor: 'pointer', textAlign: 'left',
        transition: 'all 0.12s', flexShrink: 0,
      }}
    >
      <div style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: ws.color,
        boxShadow: selected
          ? `0 0 8px ${ws.color}, 0 0 18px ${ws.color}55`
          : `0 0 5px ${ws.color}77`,
      }} />
      <span style={{
        flex: 1, fontSize: 11, fontWeight: selected ? 700 : 500,
        color: selected ? '#e2e8f0' : hov ? '#94a3b8' : '#475569',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        transition: 'color 0.12s',
      }}>
        {ws.name}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <span style={{
          fontSize: 10, fontWeight: 700,
          color: active > 0 ? '#00b4ff' : '#283044',
          textShadow: active > 0 ? '0 0 8px rgba(0,180,255,0.4)' : 'none',
        }}>
          {active}
        </span>
        {friction > 0 && (
          <>
            <span style={{ fontSize: 8, color: '#283044' }}>·</span>
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#f59e0b',
              textShadow: '0 0 8px rgba(245,158,11,0.5)',
            }}>
              {friction}
            </span>
          </>
        )}
      </div>
    </button>
  )
}

export default function CommandFeed({
  tasks,
  workspaces,
  selectedWs,
  onSelectTask,
  onSelectWs,
  onAddTask: _onAddTask,
}: {
  tasks: Task[]
  workspaces: Workspace[]
  selectedWs: Workspace | null
  onSelectTask: (t: Task) => void
  onSelectWs: (w: Workspace) => void
  onAddTask: () => void
}) {
  const [capture, setCapture] = useState('')
  const [capturing, setCapturing] = useState(false)
  const [captured, setCaptured] = useState(false)
  const [showAllWs, setShowAllWs] = useState(false)
  const [inbox, setInbox] = useState<InboxItem[]>([])
  const captureRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/inbox')
      .then(r => r.ok ? r.json() : [])
      .then(setInbox)
      .catch(() => {})
  }, [])

  const scope = selectedWs ? tasks.filter(t => t.workspace_id === selectedWs.id) : tasks
  const friction = byPriority(scope.filter(t => t.status === 'blocked'))
  const active   = byPriority(scope.filter(t => t.status === 'in_progress'))
  const ideas    = byPriority(scope.filter(t => t.status === 'idea'))

  const wsById = Object.fromEntries(workspaces.map(w => [w.id, w]))

  const wsWithWork = workspaces.filter(w =>
    tasks.some(t => t.workspace_id === w.id && (t.status === 'in_progress' || t.status === 'blocked'))
  )
  const wsExtra = workspaces.filter(w => !wsWithWork.find(a => a.id === w.id))
  const wsVisible = showAllWs ? workspaces : wsWithWork

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

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* ── Left: task list ── */}
      <div style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden',
      }}>
        {/* Quick capture */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          height: 38, padding: '0 14px', flexShrink: 0,
          background: 'rgba(0,0,0,0.5)',
          borderBottom: '1px solid rgba(0,180,255,0.07)',
        }}>
          <span style={{
            color: '#00b4ff', fontWeight: 800, fontSize: 16, lineHeight: 1,
            textShadow: '0 0 12px rgba(0,180,255,0.7), 0 0 24px rgba(0,180,255,0.3)',
          }}>›</span>
          <input
            ref={captureRef}
            value={capture}
            onChange={e => setCapture(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCapture()}
            placeholder={captured ? '✓ Captured' : 'Drop a thought, task, or idea...'}
            disabled={capturing}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 12, color: captured ? '#22c55e' : '#94a3b8', caretColor: '#00b4ff',
            }}
          />
          {capture.trim() && !capturing && (
            <button
              onClick={handleCapture}
              style={{
                fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 4,
                background: 'rgba(0,180,255,0.1)', color: '#00b4ff',
                border: '1px solid rgba(0,180,255,0.25)', cursor: 'pointer',
                boxShadow: '0 0 10px rgba(0,180,255,0.2)',
                letterSpacing: '0.06em',
              }}
            >
              CAPTURE
            </button>
          )}
        </div>

        {/* Task rows */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {friction.length > 0 && (
            <>
              <SectionLabel
                label="Friction"
                count={friction.length}
                color="#f59e0b"
                glow="0 0 10px rgba(245,158,11,0.55), 0 0 22px rgba(245,158,11,0.2)"
              />
              {friction.map(t => (
                <TaskRow
                  key={t.id}
                  task={t}
                  workspace={wsById[t.workspace_id ?? '']}
                  onClick={() => onSelectTask(t)}
                />
              ))}
            </>
          )}

          {active.length > 0 && (
            <>
              <SectionLabel label="Active" count={active.length} color="#334155" />
              {active.map(t => (
                <TaskRow
                  key={t.id}
                  task={t}
                  workspace={wsById[t.workspace_id ?? '']}
                  onClick={() => onSelectTask(t)}
                />
              ))}
            </>
          )}

          {ideas.length > 0 && (
            <>
              <SectionLabel label="Ideas" count={ideas.length} color="#283044" />
              {ideas.map(t => (
                <TaskRow
                  key={t.id}
                  task={t}
                  workspace={wsById[t.workspace_id ?? '']}
                  onClick={() => onSelectTask(t)}
                />
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

      {/* ── Right: workspace rail + inbox ── */}
      <div style={{
        width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Workspaces */}
        <div style={{ flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px 3px',
          }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', color: '#283044' }}>
              WORKSPACES
            </span>
            {wsExtra.length > 0 && (
              <button
                onClick={() => setShowAllWs(v => !v)}
                style={{
                  fontSize: 9, fontWeight: 600, color: '#334155',
                  background: 'none', border: 'none', cursor: 'pointer',
                }}
              >
                {showAllWs ? '− less' : `+ ${wsExtra.length}`}
              </button>
            )}
          </div>
          {wsVisible.map(ws => {
            const wt = tasks.filter(t => t.workspace_id === ws.id)
            return (
              <WorkspaceRow
                key={ws.id}
                ws={ws}
                active={wt.filter(t => t.status === 'in_progress').length}
                friction={wt.filter(t => t.status === 'blocked').length}
                selected={selectedWs?.id === ws.id}
                onClick={() => onSelectWs(ws)}
              />
            )
          })}
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '6px 0', flexShrink: 0 }} />

        {/* Inbox */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 12px 3px', flexShrink: 0,
          }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', color: '#283044' }}>INBOX</span>
            {inbox.length > 0 && (
              <span style={{ fontSize: 9, color: '#1e293b' }}>{inbox.length}</span>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {inbox.slice(0, 12).map(item => (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'baseline', gap: 5,
                  padding: '4px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.02)',
                }}
              >
                <span style={{ fontSize: 10, color: '#334155', flexShrink: 0 }}>·</span>
                <span style={{
                  fontSize: 10, color: '#334155', lineHeight: 1.35,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {item.content}
                </span>
              </div>
            ))}
            {inbox.length === 0 && (
              <p style={{ fontSize: 10, color: '#1e293b', padding: '4px 12px' }}>Empty.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
