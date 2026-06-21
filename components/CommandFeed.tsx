'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Task, Workspace } from '@/lib/types'

type TaskAction = 'idea' | 'in_progress' | 'blocked' | 'done'
type OperatingMode = 'sprint' | 'deep' | 'admin' | 'closeout'
type WorkLane = 'Revenue' | 'Momentum' | 'Maintenance' | 'Explore'
type ViewMode = 'active' | 'blocked' | 'ideas' | 'shipped'

const priorityRank = { high: 0, medium: 1, low: 2 } as const
const priorityLabel = { high: 'P1', medium: 'P2', low: 'P3' } as const
const statusLabel = {
  idea: 'Idea',
  in_progress: 'Active',
  blocked: 'To do',
  done: 'Done',
} as const

const modeOptions: { id: OperatingMode; label: string; time: string; color: string; intent: string }[] = [
  { id: 'sprint', label: 'Sprint', time: '45m', color: '#38bdf8', intent: 'ship the next visible output' },
  { id: 'deep', label: 'Deep', time: '90m', color: '#a78bfa', intent: 'protect one hard build session' },
  { id: 'admin', label: 'Sweep', time: '20m', color: '#f59e0b', intent: 'clear drag and tiny loops' },
  { id: 'closeout', label: 'Close', time: '10m', color: '#22c55e', intent: 'log the day and choose tomorrow' },
]

const laneTheme: Record<WorkLane, { color: string; tint: string }> = {
  Revenue: { color: '#22c55e', tint: 'rgba(34,197,94,0.12)' },
  Momentum: { color: '#38bdf8', tint: 'rgba(56,189,248,0.12)' },
  Maintenance: { color: '#f59e0b', tint: 'rgba(245,158,11,0.12)' },
  Explore: { color: '#f472b6', tint: 'rgba(244,114,182,0.12)' },
}

async function patchTask(id: string, body: Record<string, unknown>) {
  await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {})
}

function workspaceAbbr(name?: string | null) {
  if (!name) return 'BP'
  const caps = name.replace(/[^A-Z]/g, '')
  return caps.length >= 2 ? caps.slice(0, 2) : name.slice(0, 2).toUpperCase()
}

function taskText(task: Task) {
  return `${task.title} ${task.notes ?? ''}`.toLowerCase()
}

function inferWhy(task: Task) {
  const text = taskText(task)
  if (text.includes('revenue') || text.includes('client') || text.includes('lead') || text.includes('stripe')) return 'Closest to money or a customer conversation.'
  if (text.includes('video') || text.includes('content') || text.includes('article')) return 'Creates visible audience momentum instead of more planning.'
  if (text.includes('cancel')) return 'Removes avoidable spend and mental drag.'
  if (text.includes('launch') || text.includes('tier')) return 'Moves an offer closer to being sellable.'
  if (task.status === 'blocked') return 'This is ready to be pulled into focus when you choose.'
  return 'This is one of the strongest open loops in the portfolio.'
}

function notePreview(task: Task) {
  const clean = task.notes?.split('\n').map(line => line.trim()).find(Boolean)
  return clean ?? 'Open this task to add notes, links, context, or a cleaner next step.'
}

function classifyWork(task: Task): WorkLane {
  const text = taskText(task)
  if (text.includes('revenue') || text.includes('client') || text.includes('lead') || text.includes('proposal') || text.includes('stripe') || text.includes('tier')) return 'Revenue'
  if (text.includes('video') || text.includes('content') || text.includes('article') || text.includes('youtube') || text.includes('social')) return 'Momentum'
  if (text.includes('cancel') || text.includes('fix') || text.includes('seo') || text.includes('traffic data') || text.includes('dashboard')) return 'Maintenance'
  return 'Explore'
}

function needleScore(task: Task) {
  const text = taskText(task)
  let score = 50
  if (task.priority === 'high') score += 26
  if (task.priority === 'medium') score += 12
  if (task.status === 'in_progress') score += 18
  if (task.status === 'blocked') score += 14
  if (text.includes('revenue') || text.includes('client') || text.includes('lead')) score += 18
  if (text.includes('video') || text.includes('content') || text.includes('article')) score += 14
  if (text.includes('launch') || text.includes('tier')) score += 10
  if (text.includes('cancel')) score += 8
  if (text.includes('mcp') || text.includes('platform') || text.includes('automation')) score -= 8
  if (text.includes('define') || text.includes('review status')) score -= 6
  return Math.max(1, Math.min(99, score))
}

function sortForExecution(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    const statusWeight = (t: Task) => t.status === 'blocked' ? 0 : t.status === 'in_progress' ? 1 : 2
    return statusWeight(a) - statusWeight(b)
      || (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2)
      || needleScore(b) - needleScore(a)
      || a.sort_order - b.sort_order
  })
}

function isSameDay(date: string, reference: Date) {
  return new Date(date).toDateString() === reference.toDateString()
}

function Card({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <section
      style={{
        background: 'linear-gradient(180deg, rgba(13,19,31,0.84), rgba(5,8,14,0.78))',
        border: '1px solid rgba(148,163,184,0.12)',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 18px 60px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.045)',
        backdropFilter: 'blur(20px)',
        ...style,
      }}
    >
      {children}
    </section>
  )
}

function SectionTitle({ label, detail, right }: { label: string; detail?: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 850, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#f8fafc' }}>{label}</p>
        {detail && <p style={{ marginTop: 3, fontSize: 11, color: '#8fa0b7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</p>}
      </div>
      {right}
    </div>
  )
}

function ActionButton({
  children,
  onClick,
  tone = '#94a3b8',
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  tone?: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 32,
        padding: '0 12px',
        borderRadius: 6,
        border: `1px solid ${tone}44`,
        background: `${tone}18`,
        color: tone,
        fontSize: 11,
        fontWeight: 850,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div style={{ padding: 18 }}>
      <p style={{ color: '#f8fafc', fontSize: 13, fontWeight: 850 }}>{title}</p>
      <p style={{ marginTop: 6, color: '#8fa0b7', fontSize: 11, lineHeight: 1.5 }}>{detail}</p>
    </div>
  )
}

function TaskRow({
  task,
  workspace,
  onOpen,
  onStatus,
}: {
  task: Task
  workspace?: Workspace
  onOpen: () => void
  onStatus: (status: TaskAction) => void
}) {
  const lane = classifyWork(task)
  const theme = laneTheme[lane]
  const statusColor = task.status === 'blocked' ? '#f59e0b' : task.status === 'in_progress' ? '#38bdf8' : task.status === 'done' ? '#22c55e' : '#94a3b8'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <button onClick={onOpen} style={{ minWidth: 0, textAlign: 'left', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: theme.color, boxShadow: `0 0 14px ${theme.color}99`, flexShrink: 0 }} />
          <span style={{ flexShrink: 0, color: workspace?.color ?? '#38bdf8', fontSize: 9, fontWeight: 900, border: `1px solid ${(workspace?.color ?? '#38bdf8')}44`, borderRadius: 4, padding: '2px 5px', background: `${workspace?.color ?? '#38bdf8'}14` }}>
            {workspaceAbbr(workspace?.name ?? task.brand)}
          </span>
          <span style={{ minWidth: 0, color: '#f8fafc', fontSize: 13, fontWeight: 780, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ color: '#cbd5e1', fontSize: 9, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '2px 7px' }}>{priorityLabel[task.priority]}</span>
          <span style={{ color: statusColor, fontSize: 9, border: `1px solid ${statusColor}33`, borderRadius: 999, padding: '2px 7px' }}>{statusLabel[task.status]}</span>
          <span style={{ color: theme.color, fontSize: 9, border: `1px solid ${theme.color}33`, borderRadius: 999, padding: '2px 7px' }}>{lane}</span>
        </div>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {task.status !== 'in_progress' && <ActionButton tone="#38bdf8" onClick={() => onStatus('in_progress')}>Start</ActionButton>}
        {task.status !== 'blocked' && <ActionButton tone="#f59e0b" onClick={() => onStatus('blocked')}>To do</ActionButton>}
        {task.status !== 'done' && <ActionButton tone="#22c55e" onClick={() => onStatus('done')}>Done</ActionButton>}
      </div>
    </div>
  )
}

function LaneButton({
  label,
  count,
  color,
  selected,
  onClick,
}: {
  label: string
  count: number
  color: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        minHeight: 42,
        borderRadius: 8,
        border: `1px solid ${selected ? color : 'rgba(255,255,255,0.08)'}`,
        background: selected ? `${color}18` : 'rgba(255,255,255,0.035)',
        boxShadow: selected ? `0 0 28px ${color}1f` : 'none',
        padding: '9px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <p style={{ color: selected ? '#f8fafc' : '#94a3b8', fontSize: 10, fontWeight: 850, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</p>
      <p style={{ color, fontSize: 15, fontWeight: 950, lineHeight: 1 }}>{count}</p>
    </button>
  )
}

export default function CommandFeed({
  tasks: propTasks,
  workspaces,
  selectedWs,
  onSelectTask,
  onSelectWs,
  onAddTask,
  onRefresh,
  onAddWorkspace,
}: {
  tasks: Task[]
  workspaces: Workspace[]
  selectedWs: Workspace | null
  onSelectTask: (t: Task) => void
  onSelectWs: (w: Workspace) => void
  onAddTask: () => void
  onRefresh: () => void
  onAddWorkspace: () => void
}) {
  const [capture, setCapture] = useState('')
  const [capturing, setCapturing] = useState(false)
  const [statusOverrides, setStatusOverrides] = useState<Record<string, TaskAction>>({})
  const [mode, setMode] = useState<OperatingMode>('sprint')
  const [view, setView] = useState<ViewMode>('active')
  const [selectedFocusTaskId, setSelectedFocusTaskId] = useState<string | null>(null)
  const captureRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function focusIdeaCapture() {
      if (window.location.hash !== '#idea-capture') return
      requestAnimationFrame(() => captureRef.current?.focus())
    }
    focusIdeaCapture()
    window.addEventListener('hashchange', focusIdeaCapture)
    return () => window.removeEventListener('hashchange', focusIdeaCapture)
  }, [])

  const localTasks = useMemo(() => propTasks.map(task => (
    statusOverrides[task.id] ? { ...task, status: statusOverrides[task.id] } : task
  )), [propTasks, statusOverrides])
  const workspaceById = useMemo(() => Object.fromEntries(workspaces.map(w => [w.id, w])), [workspaces])
  const scopedTasks = useMemo(() => {
    const open = localTasks.filter(t => t.status !== 'done')
    return selectedWs ? open.filter(t => t.workspace_id === selectedWs.id) : open
  }, [localTasks, selectedWs])

  const active = sortForExecution(scopedTasks.filter(t => t.status === 'in_progress'))
  const blocked = sortForExecution(scopedTasks.filter(t => t.status === 'blocked'))
  const ideas = sortForExecution(scopedTasks.filter(t => t.status === 'idea'))
  const doneToday = localTasks
    .filter(t => t.status === 'done' && isSameDay(t.updated_at, new Date()))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  const focusCandidates = sortForExecution([...active, ...blocked, ...ideas])
  const commandTask = focusCandidates.find(t => t.id === selectedFocusTaskId) ?? focusCandidates[0]
  const selectedMode = modeOptions.find(option => option.id === mode) ?? modeOptions[0]
  const commandLane = commandTask ? classifyWork(commandTask) : 'Momentum'
  const commandTheme = laneTheme[commandLane]
  const laneTasks = view === 'active' ? active : view === 'blocked' ? blocked : view === 'ideas' ? ideas : doneToday
  const todayLabel = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/Phoenix',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const workspaceRows = workspaces.map(ws => {
    const open = localTasks.filter(t => t.workspace_id === ws.id && t.status !== 'done')
    return { ws, count: open.length, next: sortForExecution(open)[0] }
  })

  async function setTaskStatus(task: Task, status: TaskAction) {
    setStatusOverrides(prev => ({ ...prev, [task.id]: status }))
    await patchTask(task.id, { status })
    onRefresh()
  }

  function chooseFocus(task: Task) {
    setSelectedFocusTaskId(task.id)
  }

  function chooseNextFocus() {
    if (!focusCandidates.length) return
    const currentIndex = commandTask ? focusCandidates.findIndex(t => t.id === commandTask.id) : -1
    const next = focusCandidates[(currentIndex + 1 + focusCandidates.length) % focusCandidates.length]
    if (next) chooseFocus(next)
  }

  async function handleCapture() {
    const text = capture.trim()
    if (!text || capturing) return
    setCapturing(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: text,
          status: 'idea',
          priority: 'medium',
          workspace_id: selectedWs?.id ?? null,
          brand: selectedWs?.name ?? null,
          notes: 'Captured from the dashboard idea box.',
        }),
      })
      if (res.ok) {
        setCapture('')
        setView('ideas')
        onRefresh()
      }
    } finally {
      setCapturing(false)
    }
  }

  function workspaceFor(task: Task) {
    return task.workspace_id ? workspaceById[task.workspace_id] : undefined
  }

  return (
    <div
      className="dashboard-command-feed"
      style={{
        height: '100%',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 330px',
        gap: 16,
        padding: 16,
        overflow: 'hidden',
        background: `
          radial-gradient(circle at 12% 0%, rgba(56,189,248,0.18), transparent 34%),
          radial-gradient(circle at 88% 12%, rgba(244,114,182,0.13), transparent 30%),
          radial-gradient(circle at 52% 98%, rgba(34,197,94,0.10), transparent 34%),
          linear-gradient(180deg, rgba(4,8,15,0.96), rgba(2,5,9,0.99))
        `,
      }}
    >
      <div className="dashboard-command-primary" style={{ minWidth: 0, overflow: 'auto', paddingRight: 2 }}>
        <div className="dashboard-command-primary-inner" style={{ display: 'grid', gap: 16, minWidth: 720 }}>
          <div className="dashboard-command-topbar" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'center' }}>
            <div className="dashboard-command-datebar" style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: commandTheme.color, boxShadow: `0 0 16px ${commandTheme.color}`, flexShrink: 0 }} />
              <span style={{ color: '#f8fafc', fontSize: 13, fontWeight: 900 }}>{todayLabel}</span>
              <span style={{ color: commandTheme.color, fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {selectedWs ? selectedWs.name : 'All workspaces'}
              </span>
              <span style={{ color: '#7f8da3', fontSize: 11 }}>
                {selectedMode.label} {selectedMode.time}: {selectedMode.intent}
              </span>
            </div>
            <div className="dashboard-mode-bar" style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {modeOptions.map(option => {
                const selected = option.id === mode
                return (
                  <button
                    key={option.id}
                    onClick={() => setMode(option.id)}
                    className={`dashboard-mode-button ${selected ? 'is-selected' : ''}`}
                    style={{
                      height: 30,
                      padding: '0 9px',
                      borderRadius: 5,
                      border: `1px solid ${selected ? option.color : 'rgba(255,255,255,0.1)'}`,
                      background: selected ? `${option.color}1f` : 'rgba(255,255,255,0.035)',
                      color: selected ? '#f8fafc' : '#94a3b8',
                      fontSize: 11,
                      fontWeight: 850,
                      cursor: 'pointer',
                    }}
                  >
                    {option.label} {option.time}
                  </button>
                )
              })}
            </div>
          </div>

          <Card style={{ borderColor: `${commandTheme.color}33` }}>
            {commandTask ? (
              <div className="dashboard-command-focus-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 240px', gap: 0 }}>
                <div style={{ padding: 22, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: workspaceFor(commandTask)?.color ?? commandTheme.color, fontSize: 11, fontWeight: 900, letterSpacing: '0.1em' }}>
                      {workspaceFor(commandTask)?.name ?? commandTask.brand ?? 'Unassigned'}
                    </span>
                    <span style={{ color: '#cbd5e1', fontSize: 10, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, padding: '2px 8px' }}>{priorityLabel[commandTask.priority]}</span>
                    <span style={{ color: commandTheme.color, fontSize: 10, border: `1px solid ${commandTheme.color}33`, borderRadius: 999, padding: '2px 8px' }}>{commandLane}</span>
                    <span style={{ color: commandTask.status === 'in_progress' ? '#38bdf8' : commandTask.status === 'blocked' ? '#f59e0b' : '#94a3b8', fontSize: 10, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, padding: '2px 8px' }}>
                      {statusLabel[commandTask.status]}
                    </span>
                  </div>
                  <button
                    onClick={() => onSelectTask(commandTask)}
                    style={{
                      display: 'block',
                      width: '100%',
                      marginTop: 13,
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                      color: '#f8fafc',
                      fontSize: 30,
                      lineHeight: 1.08,
                      fontWeight: 920,
                      letterSpacing: 0,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    {commandTask.title}
                  </button>
                  <p style={{ color: '#9ca9bb', fontSize: 13, lineHeight: 1.55, marginTop: 11 }}>{notePreview(commandTask)}</p>
                  <p style={{ color: '#64748b', fontSize: 11, lineHeight: 1.45, marginTop: 8 }}>{inferWhy(commandTask)}</p>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
                    {commandTask.status !== 'in_progress' && <ActionButton tone="#38bdf8" onClick={() => setTaskStatus(commandTask, 'in_progress')}>Start</ActionButton>}
                    <ActionButton tone="#f8fafc" onClick={() => onSelectTask(commandTask)}>Open / edit</ActionButton>
                    <ActionButton tone="#a78bfa" onClick={chooseNextFocus}>Pick another</ActionButton>
                    {commandTask.status !== 'blocked' && <ActionButton tone="#f59e0b" onClick={() => setTaskStatus(commandTask, 'blocked')}>To do</ActionButton>}
                    <ActionButton tone="#22c55e" onClick={() => setTaskStatus(commandTask, 'done')}>Mark done</ActionButton>
                  </div>
                </div>

                <div className="dashboard-command-focus-score" style={{ padding: 18, borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'grid', alignContent: 'center', justifyItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 132,
                    height: 132,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: `conic-gradient(${commandTheme.color} ${needleScore(commandTask) * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
                    boxShadow: `0 0 36px ${commandTheme.color}24`,
                  }}>
                    <div style={{ width: 104, height: 104, borderRadius: '50%', background: '#07101a', display: 'grid', placeItems: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ color: commandTheme.color, fontSize: 30, lineHeight: 1, fontWeight: 950 }}>{needleScore(commandTask)}</p>
                        <p style={{ color: '#7f8da3', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 5 }}>Needle</p>
                      </div>
                    </div>
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.45, textAlign: 'center' }}>
                    Use this as a quick signal, not a command. Pick another anytime.
                  </p>
                </div>
              </div>
            ) : (
              <EmptyState title="No open task in this scope" detail="Capture a thought or switch workspaces to choose today’s win." />
            )}
          </Card>

          <div className="dashboard-lane-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            <LaneButton label="Active" count={active.length} color="#38bdf8" selected={view === 'active'} onClick={() => setView('active')} />
            <LaneButton label="To do" count={blocked.length} color="#f59e0b" selected={view === 'blocked'} onClick={() => setView('blocked')} />
            <LaneButton label="Ideas" count={ideas.length} color="#f472b6" selected={view === 'ideas'} onClick={() => setView('ideas')} />
            <LaneButton label="Shipped" count={doneToday.length} color="#22c55e" selected={view === 'shipped'} onClick={() => setView('shipped')} />
          </div>

          <Card>
            <SectionTitle
              label={view === 'active' ? 'Today tray' : view === 'blocked' ? 'To-do tray' : view === 'ideas' ? 'Parking lot' : 'Ship log'}
              detail={view === 'active' ? 'Keep this short enough to trust.' : view === 'blocked' ? 'Pick one and move it into focus.' : view === 'ideas' ? 'Interesting, but not all today.' : 'Proof that the day moved.'}
              right={<ActionButton tone="#38bdf8" onClick={onAddTask}>New task</ActionButton>}
            />
            {laneTasks.length ? laneTasks.slice(0, 8).map(task => (
              <TaskRow
                key={task.id}
                task={task}
                workspace={workspaceFor(task)}
                onOpen={() => { chooseFocus(task); onSelectTask(task) }}
                onStatus={status => setTaskStatus(task, status)}
              />
            )) : (
              <EmptyState
                title={view === 'shipped' ? 'Nothing shipped today yet' : 'This lane is clear'}
                detail={view === 'shipped' ? 'Finish one visible output and this becomes your win board.' : 'A quiet lane is good. Keep the room light.'}
              />
            )}
          </Card>

          <Card>
            <SectionTitle label="Portfolio pulse" detail="A soft scan, not a command center wall." right={<ActionButton onClick={onAddWorkspace}>Add</ActionButton>} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {workspaceRows.slice(0, 8).map(({ ws, count, next }) => (
                <button
                  key={ws.id}
                  onClick={() => onSelectWs(ws)}
                  style={{
                    minHeight: 104,
                    textAlign: 'left',
                    padding: 14,
                    border: 'none',
                    borderRight: '1px solid rgba(255,255,255,0.05)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: selectedWs?.id === ws.id ? `${ws.color}16` : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: ws.color, boxShadow: `0 0 12px ${ws.color}88` }} />
                    <span style={{ color: '#f8fafc', fontSize: 13, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
                    <span style={{ marginLeft: 'auto', color: ws.color, fontSize: 11, fontWeight: 850 }}>{count}</span>
                  </div>
                  <p style={{ color: next ? '#94a3b8' : '#64748b', fontSize: 11, lineHeight: 1.4, marginTop: 12, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {next ? next.title : 'Clear for now'}
                  </p>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <aside className="dashboard-command-aside" style={{ minWidth: 0, display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 16, overflow: 'hidden' }}>
        <Card
          style={{
            borderColor: 'rgba(244,114,182,0.24)',
            background: `
              radial-gradient(circle at 12% 0%, rgba(244,114,182,0.18), transparent 38%),
              radial-gradient(circle at 88% 20%, rgba(167,139,250,0.16), transparent 36%),
              rgba(8,8,17,0.84)
            `,
          }}
        >
          <div id="idea-capture" style={{ scrollMarginTop: 90 }} />
          <SectionTitle label="Idea" detail="Catch it before it wanders off." />
          <div style={{ padding: 12 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <input
                ref={captureRef}
                value={capture}
                onChange={e => setCapture(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCapture()
                }}
                placeholder="Quick idea, rough thought, thing to try..."
                disabled={capturing}
                style={{
                  minWidth: 0,
                  height: 38,
                  borderRadius: 5,
                  border: '1px solid rgba(244,114,182,0.22)',
                  background: 'rgba(0,0,0,0.24)',
                  color: '#f8fafc',
                  padding: '0 12px',
                  outline: 'none',
                  fontSize: 12,
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.02) inset',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ActionButton tone="#f472b6" onClick={handleCapture} disabled={!capture.trim() || capturing}>
                  Save idea
                </ActionButton>
                <span style={{ color: '#64748b', fontSize: 10, lineHeight: 1.35 }}>
                  {selectedWs ? `Drops into ${selectedWs.name}` : 'Drops into all-workspace ideas'}
                </span>
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gap: 7 }}>
              {ideas.slice(0, 4).map(item => (
                <p key={item.id} style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.35, borderTop: '1px solid rgba(244,114,182,0.10)', paddingTop: 7 }}>
                  {item.title}
                </p>
              ))}
              {!ideas.length && <p style={{ color: '#64748b', fontSize: 11 }}>No parked ideas in this scope.</p>}
            </div>
          </div>
        </Card>

        <Card style={{ borderColor: 'rgba(56,189,248,0.22)', background: 'linear-gradient(180deg, rgba(8,18,29,0.9), rgba(5,8,14,0.8))' }}>
          <SectionTitle
            label="Choose focus"
            detail="Click one to put it in the main banner."
          />
          <div style={{ padding: 10, display: 'grid', gap: 7 }}>
            {focusCandidates.length ? focusCandidates.slice(0, 7).map(task => {
              const selected = commandTask?.id === task.id
              const workspace = workspaceFor(task)
              const lane = classifyWork(task)
              const color = selected ? (workspace?.color ?? laneTheme[lane].color) : 'rgba(255,255,255,0.08)'
              return (
                <button
                  key={task.id}
                  onClick={() => chooseFocus(task)}
                  style={{
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: 8,
                    alignItems: 'center',
                    textAlign: 'left',
                    padding: '9px 10px',
                    borderRadius: 7,
                    border: `1px solid ${color}`,
                    background: selected ? `${workspace?.color ?? laneTheme[lane].color}14` : 'rgba(255,255,255,0.025)',
                    color: '#f8fafc',
                    fontSize: 12,
                    lineHeight: 1.35,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                  <span style={{ color: task.status === 'in_progress' ? '#38bdf8' : task.status === 'blocked' ? '#f59e0b' : '#94a3b8', fontSize: 9, fontWeight: 850 }}>
                    {statusLabel[task.status]}
                  </span>
                </button>
              )}
            ) : (
              <p style={{ color: '#64748b', fontSize: 11, lineHeight: 1.45, padding: 4 }}>No open tasks in this scope.</p>
            )}
          </div>
        </Card>

        <Card style={{ overflow: 'hidden' }}>
          <SectionTitle label="Workspaces" detail={selectedWs ? `Filtered to ${selectedWs.name}` : 'Portfolio'} />
          <div style={{ overflow: 'auto', maxHeight: '100%', padding: 8 }}>
            {workspaces.map(ws => (
              <button
                key={ws.id}
                onClick={() => onSelectWs(ws)}
                style={{
                  width: '100%',
                  minHeight: 36,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '7px 8px',
                  borderRadius: 7,
                  border: 'none',
                  background: selectedWs?.id === ws.id ? `${ws.color}18` : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: ws.color, boxShadow: selectedWs?.id === ws.id ? `0 0 12px ${ws.color}` : 'none', flexShrink: 0 }} />
                <span style={{ flex: 1, color: '#e2e8f0', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
                <span style={{ color: '#64748b', fontSize: 11 }}>{ws.idea_count}</span>
              </button>
            ))}
          </div>
        </Card>
      </aside>
    </div>
  )
}
