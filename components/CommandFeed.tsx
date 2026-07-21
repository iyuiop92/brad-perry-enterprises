'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { DailyState, HealthLog, InboxItem, RecurringDailyItem, Task, Workspace } from '@/lib/types'
import VideoPipelinePanel from '@/components/VideoPipelinePanel'

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

const modeOptions: { id: OperatingMode; label: string; time: string; minutes: number; color: string; intent: string }[] = [
  { id: 'sprint', label: 'Sprint', time: '45m', minutes: 45, color: '#38bdf8', intent: 'ship the next visible output' },
  { id: 'deep', label: 'Deep', time: '90m', minutes: 90, color: '#a78bfa', intent: 'protect one hard build session' },
  { id: 'admin', label: 'Sweep', time: '20m', minutes: 20, color: '#f59e0b', intent: 'clear drag and tiny loops' },
  { id: 'closeout', label: 'Close', time: '10m', minutes: 10, color: '#22c55e', intent: 'log the day and choose tomorrow' },
]

const laneTheme: Record<WorkLane, { color: string; tint: string }> = {
  Revenue: { color: '#22c55e', tint: 'rgba(34,197,94,0.12)' },
  Momentum: { color: '#38bdf8', tint: 'rgba(56,189,248,0.12)' },
  Maintenance: { color: '#f59e0b', tint: 'rgba(245,158,11,0.12)' },
  Explore: { color: '#f472b6', tint: 'rgba(244,114,182,0.12)' },
}

const defaultRecurringItems: RecurringDailyItem[] = [
  { id: 'bp', label: 'Blood pressure', done: false },
  { id: 'food', label: 'Log food', done: false },
  { id: 'workout', label: 'Workout or walk', done: false },
  { id: 'calendar', label: 'Check calendar', done: false },
  { id: 'money', label: 'Money/client follow-up', done: false },
]

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

function shortDateTime(date: string) {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatTimer(seconds: number) {
  const safeSeconds = Math.max(0, seconds)
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
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
        <p style={{ fontSize: 13, fontWeight: 850, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#f8fafc' }}>{label}</p>
        {detail && <p style={{ marginTop: 3, fontSize: 13, color: '#8fa0b7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</p>}
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
        borderRadius: 5,
        border: `1px solid ${tone}44`,
        background: `${tone}18`,
        color: tone,
        fontSize: 13,
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
      <p style={{ color: '#f8fafc', fontSize: 15, fontWeight: 850 }}>{title}</p>
      <p style={{ marginTop: 6, color: '#8fa0b7', fontSize: 13, lineHeight: 1.5 }}>{detail}</p>
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
          <span style={{ flexShrink: 0, color: workspace?.color ?? '#38bdf8', fontSize: 11, fontWeight: 900, border: `1px solid ${(workspace?.color ?? '#38bdf8')}44`, borderRadius: 4, padding: '2px 5px', background: `${workspace?.color ?? '#38bdf8'}14` }}>
            {workspaceAbbr(workspace?.name ?? task.brand)}
          </span>
          <span style={{ minWidth: 0, color: '#f8fafc', fontSize: 15, fontWeight: 780, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ color: '#cbd5e1', fontSize: 11, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '2px 7px' }}>{priorityLabel[task.priority]}</span>
          <span style={{ color: statusColor, fontSize: 11, border: `1px solid ${statusColor}33`, borderRadius: 999, padding: '2px 7px' }}>{statusLabel[task.status]}</span>
          <span style={{ color: theme.color, fontSize: 11, border: `1px solid ${theme.color}33`, borderRadius: 999, padding: '2px 7px' }}>{lane}</span>
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
      <p style={{ color: selected ? '#f8fafc' : '#94a3b8', fontSize: 11, fontWeight: 850, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</p>
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
  const [timerMode, setTimerMode] = useState<OperatingMode | null>(null)
  const [timerRemaining, setTimerRemaining] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [view, setView] = useState<ViewMode>('active')
  const [selectedFocusTaskId, setSelectedFocusTaskId] = useState<string | null>(null)
  const [healthLogs, setHealthLogs] = useState<HealthLog[]>([])
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([])
  const [inboxText, setInboxText] = useState('')
  const [quickText, setQuickText] = useState('')
  const [closeoutNote, setCloseoutNote] = useState('')
  const [tomorrowFocusId, setTomorrowFocusId] = useState<string | null>(null)
  const [calendarText, setCalendarText] = useState('')
  const [calendarItems, setCalendarItems] = useState<string[]>([])
  const [recurringItems, setRecurringItems] = useState<RecurringDailyItem[]>(defaultRecurringItems)
  const [dailyStateLoaded, setDailyStateLoaded] = useState(false)
  const captureRef = useRef<HTMLInputElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!timerRunning) return

    const interval = window.setInterval(() => {
      setTimerRemaining(current => {
        if (current <= 1) {
          setTimerRunning(false)
          return 0
        }

        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [timerRunning])

  useEffect(() => {
    function handleDashboardHash() {
      if (window.location.hash === '#idea-capture') {
        setView('ideas')
        document.getElementById('idea-capture')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        requestAnimationFrame(() => captureRef.current?.focus())
        return
      }

      if (window.location.hash === '#board') {
        setView('active')
        boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }

    handleDashboardHash()
    window.addEventListener('hashchange', handleDashboardHash)
    return () => window.removeEventListener('hashchange', handleDashboardHash)
  }, [])

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.ok ? res.json() : [])
      .then((logs: HealthLog[]) => setHealthLogs(logs))
      .catch(() => setHealthLogs([]))
  }, [])

  useEffect(() => {
    fetch('/api/inbox')
      .then(res => res.ok ? res.json() : [])
      .then((items: InboxItem[]) => setInboxItems(items))
      .catch(() => setInboxItems([]))
  }, [])

  useEffect(() => {
    fetch('/api/daily-state')
      .then(res => res.ok ? res.json() : null)
      .then((state: DailyState | null) => {
        if (!state) return
        setTomorrowFocusId(state.tomorrow_focus_task_id)
        setCloseoutNote(state.closeout_note ?? '')
        setCalendarItems(Array.isArray(state.calendar_items) ? state.calendar_items : [])
        setRecurringItems(Array.isArray(state.recurring_items) && state.recurring_items.length ? state.recurring_items : defaultRecurringItems)
      })
      .catch(() => {})
      .finally(() => setDailyStateLoaded(true))
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
  const nextThree = focusCandidates.filter(t => t.id !== commandTask?.id).slice(0, 3)
  const parkedToday = [...blocked, ...ideas].filter(t => t.id !== commandTask?.id).slice(0, 3)
  const latestBloodPressure = healthLogs.find(log => log.entry_type === 'blood_pressure')
  const latestNutrition = healthLogs.find(log => log.entry_type === 'nutrition')
  const latestWorkout = healthLogs.find(log => log.entry_type === 'workout')
  const tomorrowFocus = localTasks.find(task => task.id === tomorrowFocusId)
  const stillOpen = sortForExecution(scopedTasks.filter(task => task.status === 'in_progress' || task.status === 'blocked')).slice(0, 5)
  const recurringDone = recurringItems.filter(item => item.done).length
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

  async function captureInbox() {
    const content = inboxText.trim()
    if (!content) return
    setInboxText('')
    const res = await fetch('/api/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    if (res.ok) {
      const item: InboxItem = await res.json()
      setInboxItems(prev => [item, ...prev])
    }
  }

  // Top-of-dashboard quick capture — same inbox, no scrolling to reach it.
  async function captureQuick() {
    const content = quickText.trim()
    if (!content) return
    setQuickText('')
    const res = await fetch('/api/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    if (res.ok) {
      const item: InboxItem = await res.json()
      setInboxItems(prev => [item, ...prev])
    }
  }

  async function clearInboxItem(item: InboxItem) {
    setInboxItems(prev => prev.filter(i => i.id !== item.id))
    await fetch(`/api/inbox/${item.id}`, { method: 'DELETE' }).catch(() => {})
  }

  async function saveDailyState(patch: Partial<Pick<DailyState, 'tomorrow_focus_task_id' | 'closeout_note' | 'calendar_items' | 'recurring_items'>>) {
    if (!dailyStateLoaded) return
    await fetch('/api/daily-state', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => {})
  }

  async function convertInboxToIdea(item: InboxItem) {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: item.content,
        status: 'idea',
        priority: 'medium',
        workspace_id: selectedWs?.id ?? null,
        brand: selectedWs?.name ?? null,
        notes: 'Converted from universal inbox.',
      }),
    })
    if (res.ok) {
      setView('ideas')
      await clearInboxItem(item)
      onRefresh()
    }
  }

  function setTomorrowFocus(task: Task) {
    setTomorrowFocusId(task.id)
    void saveDailyState({ tomorrow_focus_task_id: task.id })
  }

  function saveCloseoutNote(value: string) {
    setCloseoutNote(value)
    void saveDailyState({ closeout_note: value })
  }

  function addCalendarItem() {
    const item = calendarText.trim()
    if (!item) return
    const next = [item, ...calendarItems].slice(0, 6)
    setCalendarText('')
    setCalendarItems(next)
    void saveDailyState({ calendar_items: next })
  }

  function removeCalendarItem(index: number) {
    const next = calendarItems.filter((_, i) => i !== index)
    setCalendarItems(next)
    void saveDailyState({ calendar_items: next })
  }

  function toggleRecurring(id: string) {
    const next = recurringItems.map(item => item.id === id ? { ...item, done: !item.done } : item)
    setRecurringItems(next)
    void saveDailyState({ recurring_items: next })
  }

  function toggleTimer(option: typeof modeOptions[number]) {
    setMode(option.id)

    if (timerMode !== option.id || timerRemaining === 0) {
      setTimerMode(option.id)
      setTimerRemaining(option.minutes * 60)
      setTimerRunning(true)
      return
    }

    setTimerRunning(running => !running)
  }

  function resetTimer() {
    setTimerMode(null)
    setTimerRemaining(0)
    setTimerRunning(false)
  }

  function workspaceFor(task: Task) {
    return task.workspace_id ? workspaceById[task.workspace_id] : undefined
  }

  return (
    <div
      id="board"
      ref={boardRef}
      className="dashboard-command-feed"
      style={{
        height: '100%',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: 0,
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
              <span style={{ color: '#f8fafc', fontSize: 15, fontWeight: 900 }}>{todayLabel}</span>
              <span style={{ color: commandTheme.color, fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {selectedWs ? selectedWs.name : 'All workspaces'}
              </span>
              <span style={{ color: '#7f8da3', fontSize: 13 }}>
                {selectedMode.label} {selectedMode.time}: {selectedMode.intent}
              </span>
            </div>
            <div className="dashboard-mode-bar" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
              {modeOptions.map(option => {
                const selected = option.id === mode
                const timerActive = timerMode === option.id && timerRemaining > 0
                return (
                  <button
                    key={option.id}
                    onClick={() => toggleTimer(option)}
                    className={`dashboard-mode-button ${selected ? 'is-selected' : ''}`}
                    title={timerActive ? `${timerRunning ? 'Pause' : 'Resume'} ${option.label}` : `Start ${option.label}`}
                    style={{
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                      whiteSpace: 'nowrap',
                      color: selected ? option.color : 'rgba(255,255,255,0.4)',
                      textShadow: selected ? `0 0 10px ${option.color}66` : 'none',
                      fontSize: 12,
                      fontWeight: selected ? 800 : 600,
                      cursor: 'pointer',
                    }}
                  >
                    {option.label} {timerActive ? formatTimer(timerRemaining) : option.time}
                  </button>
                )
              })}
              {timerMode && (
                <button
                  onClick={resetTimer}
                  className="dashboard-mode-button"
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    whiteSpace: 'nowrap',
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Quick capture — first thing under the date, so a thought can be
              dumped before it's forgotten without scrolling. Same universal inbox. */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={quickText}
              onChange={e => setQuickText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') captureQuick() }}
              placeholder="Quick capture — dump a thought before you forget…"
              style={{
                flex: 1,
                minWidth: 0,
                height: 42,
                padding: '0 14px',
                border: '1px solid rgba(244,114,182,0.3)',
                borderRadius: 10,
                background: 'rgba(244,114,182,0.05)',
                color: '#f8fafc',
                outline: 'none',
                fontSize: 16,
              }}
            />
            <ActionButton tone="#f472b6" onClick={captureQuick} disabled={!quickText.trim()}>Capture</ActionButton>
          </div>

          <Card
            style={{
              borderColor: 'rgba(34,197,94,0.25)',
              background: `
                radial-gradient(circle at 8% 0%, rgba(34,197,94,0.16), transparent 34%),
                radial-gradient(circle at 88% 8%, rgba(56,189,248,0.13), transparent 34%),
                linear-gradient(180deg, rgba(8,18,25,0.9), rgba(5,8,14,0.82))
              `,
            }}
          >
            <SectionTitle
              label="Today plan"
              detail="Main win, next moves, parked work, body check."
              right={<ActionButton tone="#22c55e" onClick={onAddTask}>Add task</ActionButton>}
            />
            <div className="dashboard-today-plan-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 0.9fr', gap: 0 }}>
              <div style={{ padding: 14, borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ color: '#22c55e', fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Main win</p>
                {commandTask ? (
                  <>
                    <button
                      onClick={() => onSelectTask(commandTask)}
                      style={{
                        width: '100%',
                        marginTop: 9,
                        padding: 0,
                        border: 'none',
                        background: 'transparent',
                        color: '#f8fafc',
                        textAlign: 'left',
                        fontSize: 17,
                        lineHeight: 1.25,
                        fontWeight: 900,
                        cursor: 'pointer',
                      }}
                    >
                      {commandTask.title}
                    </button>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
                      {commandTask.status !== 'in_progress' && <ActionButton tone="#38bdf8" onClick={() => setTaskStatus(commandTask, 'in_progress')}>Start</ActionButton>}
                      <ActionButton tone="#22c55e" onClick={() => setTaskStatus(commandTask, 'done')}>Done</ActionButton>
                      <ActionButton tone="#a78bfa" onClick={chooseNextFocus}>Switch</ActionButton>
                    </div>
                  </>
                ) : (
                  <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.45, marginTop: 9 }}>No open task selected.</p>
                )}
              </div>

              <div style={{ padding: 14, borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ color: '#38bdf8', fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Next 3</p>
                <div style={{ display: 'grid', gap: 7, marginTop: 9 }}>
                  {nextThree.length ? nextThree.map(task => (
                    <button
                      key={task.id}
                      onClick={() => { chooseFocus(task); onSelectTask(task) }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) auto',
                        gap: 8,
                        alignItems: 'center',
                        minHeight: 30,
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 5,
                        background: 'rgba(255,255,255,0.025)',
                        color: '#cbd5e1',
                        padding: '7px 8px',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 750 }}>{task.title}</span>
                      <span style={{ color: task.status === 'in_progress' ? '#38bdf8' : task.status === 'blocked' ? '#f59e0b' : '#f472b6', fontSize: 11, fontWeight: 850 }}>{statusLabel[task.status]}</span>
                    </button>
                  )) : (
                    <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.45 }}>No extra open moves.</p>
                  )}
                </div>
              </div>

              <div style={{ padding: 14, borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ color: '#f59e0b', fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Parked</p>
                <div style={{ display: 'grid', gap: 7, marginTop: 9 }}>
                  {parkedToday.length ? parkedToday.map(task => (
                    <button
                      key={task.id}
                      onClick={() => { chooseFocus(task); setTaskStatus(task, 'in_progress') }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) auto',
                        gap: 8,
                        alignItems: 'center',
                        minHeight: 30,
                        border: '1px solid rgba(245,158,11,0.14)',
                        borderRadius: 5,
                        background: 'rgba(245,158,11,0.045)',
                        color: '#cbd5e1',
                        padding: '7px 8px',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 750 }}>{task.title}</span>
                      <span style={{ color: '#f59e0b', fontSize: 11, fontWeight: 850 }}>Pull</span>
                    </button>
                  )) : (
                    <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.45 }}>Nothing parked in this scope.</p>
                  )}
                </div>
              </div>

              <div style={{ padding: 14 }}>
                <p style={{ color: '#a78bfa', fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Body check</p>
                <div style={{ display: 'grid', gap: 7, marginTop: 9 }}>
                  <p style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.4 }}>
                    BP: {latestBloodPressure?.bp_systolic && latestBloodPressure.bp_diastolic
                      ? `${latestBloodPressure.bp_systolic}/${latestBloodPressure.bp_diastolic} ${latestBloodPressure.pulse ? `P${latestBloodPressure.pulse}` : ''}`
                      : 'not logged'}
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.4 }}>
                    Food: {latestNutrition?.meal_name ?? (latestNutrition?.calories ? `${latestNutrition.calories} cal` : 'not logged')}
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.4 }}>
                    Workout: {latestWorkout?.workout_type ?? (latestWorkout?.duration_mins ? `${latestWorkout.duration_mins} min` : 'not logged')}
                  </p>
                  <a
                    href="/dashboard/health"
                    style={{
                      width: 'fit-content',
                      color: '#a78bfa',
                      fontSize: 11,
                      fontWeight: 850,
                      textDecoration: 'none',
                    }}
                  >
                    Open health
                  </a>
                </div>
              </div>
            </div>
            {(latestBloodPressure || latestNutrition || latestWorkout) && (
              <div style={{ padding: '0 14px 12px', color: '#64748b', fontSize: 11 }}>
                Latest health signal: {shortDateTime((latestBloodPressure ?? latestNutrition ?? latestWorkout)?.logged_at ?? new Date().toISOString())}
              </div>
            )}
          </Card>

          <Card
            style={{
              borderColor: 'rgba(56,189,248,0.22)',
              background: 'linear-gradient(180deg, rgba(6,16,27,0.92), rgba(5,8,14,0.82))',
            }}
          >
            <SectionTitle
              label="Daily closeout"
              detail="Review what moved, choose tomorrow, clear the drag."
              right={tomorrowFocus ? <ActionButton tone="#22c55e" onClick={() => onSelectTask(tomorrowFocus)}>Tomorrow set</ActionButton> : undefined}
            />
            <div className="dashboard-daily-systems-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
              <div style={{ padding: 14, borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ color: '#22c55e', fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Shipped today</p>
                <div style={{ display: 'grid', gap: 7, marginTop: 9 }}>
                  {doneToday.length ? doneToday.slice(0, 4).map(task => (
                    <button
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      style={{
                        minHeight: 30,
                        padding: '7px 8px',
                        border: '1px solid rgba(34,197,94,0.14)',
                        borderRadius: 5,
                        background: 'rgba(34,197,94,0.045)',
                        color: '#cbd5e1',
                        textAlign: 'left',
                        fontSize: 13,
                        fontWeight: 750,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                      }}
                    >
                      {task.title}
                    </button>
                  )) : (
                    <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.45 }}>Nothing marked done today yet.</p>
                  )}
                </div>
              </div>

              <div style={{ padding: 14, borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ color: '#f59e0b', fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Still open</p>
                <div style={{ display: 'grid', gap: 7, marginTop: 9 }}>
                  {stillOpen.length ? stillOpen.map(task => (
                    <button
                      key={task.id}
                      onClick={() => setTomorrowFocus(task)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) auto',
                        gap: 8,
                        alignItems: 'center',
                        minHeight: 30,
                        padding: '7px 8px',
                        border: `1px solid ${tomorrowFocusId === task.id ? 'rgba(34,197,94,0.45)' : 'rgba(255,255,255,0.07)'}`,
                        borderRadius: 5,
                        background: tomorrowFocusId === task.id ? 'rgba(34,197,94,0.10)' : 'rgba(255,255,255,0.025)',
                        color: '#cbd5e1',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 750 }}>{task.title}</span>
                      <span style={{ color: tomorrowFocusId === task.id ? '#22c55e' : '#64748b', fontSize: 11, fontWeight: 850 }}>
                        {tomorrowFocusId === task.id ? 'First' : 'Set'}
                      </span>
                    </button>
                  )) : (
                    <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.45 }}>No active or to-do items left in this scope.</p>
                  )}
                </div>
              </div>

              <div style={{ padding: 14 }}>
                <p style={{ color: '#a78bfa', fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Closeout note</p>
                <textarea
                  value={closeoutNote}
                  onChange={e => saveCloseoutNote(e.target.value)}
                  placeholder="Energy, body note, tomorrow context..."
                  rows={5}
                  style={{
                    width: '100%',
                    minHeight: 92,
                    marginTop: 9,
                    padding: '9px 10px',
                    border: '1px solid rgba(167,139,250,0.18)',
                    borderRadius: 5,
                    background: 'rgba(0,0,0,0.22)',
                    color: '#cbd5e1',
                    outline: 'none',
                    resize: 'vertical',
                    fontSize: 14,
                    lineHeight: 1.45,
                  }}
                />
              </div>
            </div>
          </Card>

          <div className="dashboard-daily-systems-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
            <Card
              style={{
                borderColor: 'rgba(244,114,182,0.22)',
                background: 'linear-gradient(180deg, rgba(24,10,21,0.9), rgba(5,8,14,0.82))',
              }}
            >
              <SectionTitle label="Universal inbox" detail="Text, reminder, link, errand, rough thought." />
              <div style={{ padding: 14 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={inboxText}
                    onChange={e => setInboxText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') captureInbox() }}
                    placeholder="Capture anything..."
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: 38,
                      padding: '0 11px',
                      border: '1px solid rgba(244,114,182,0.22)',
                      borderRadius: 5,
                      background: 'rgba(0,0,0,0.24)',
                      color: '#f8fafc',
                      outline: 'none',
                      fontSize: 14,
                    }}
                  />
                  <ActionButton tone="#f472b6" onClick={captureInbox} disabled={!inboxText.trim()}>Capture</ActionButton>
                </div>
                <div style={{ display: 'grid', gap: 7, marginTop: 12 }}>
                  {inboxItems.slice(0, 5).map(item => (
                    <div
                      key={item.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                        gap: 8,
                        alignItems: 'center',
                        minHeight: 32,
                        padding: '7px 8px',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 5,
                        background: 'rgba(255,255,255,0.025)',
                      }}
                    >
                      <span style={{ color: '#cbd5e1', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.content}</span>
                      <button
                        onClick={() => convertInboxToIdea(item)}
                        style={{ color: '#f472b6', background: 'none', border: 'none', fontSize: 11, fontWeight: 850, cursor: 'pointer' }}
                      >
                        Idea
                      </button>
                      <button
                        onClick={() => clearInboxItem(item)}
                        style={{ color: '#64748b', background: 'none', border: 'none', fontSize: 11, fontWeight: 850, cursor: 'pointer' }}
                      >
                        Clear
                      </button>
                    </div>
                  ))}
                  {!inboxItems.length && <p style={{ color: '#64748b', fontSize: 14 }}>Inbox is clear.</p>}
                </div>
              </div>
            </Card>

            <Card
              style={{
                borderColor: 'rgba(56,189,248,0.20)',
                background: 'linear-gradient(180deg, rgba(7,18,29,0.9), rgba(5,8,14,0.82))',
              }}
            >
              <SectionTitle label="Calendar prep" detail="Manual now. Apple Calendar connection later." />
              <div style={{ padding: 14 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={calendarText}
                    onChange={e => setCalendarText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addCalendarItem() }}
                    placeholder="Place, appointment, call, leave time..."
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: 38,
                      padding: '0 11px',
                      border: '1px solid rgba(56,189,248,0.22)',
                      borderRadius: 5,
                      background: 'rgba(0,0,0,0.24)',
                      color: '#f8fafc',
                      outline: 'none',
                      fontSize: 14,
                    }}
                  />
                  <ActionButton tone="#38bdf8" onClick={addCalendarItem} disabled={!calendarText.trim()}>Add</ActionButton>
                </div>
                <div style={{ display: 'grid', gap: 7, marginTop: 12 }}>
                  {calendarItems.map((item, index) => (
                    <button
                      key={`${item}-${index}`}
                      onClick={() => removeCalendarItem(index)}
                      style={{
                        minHeight: 32,
                        padding: '7px 8px',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 5,
                        background: 'rgba(255,255,255,0.025)',
                        color: '#cbd5e1',
                        textAlign: 'left',
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      {item}
                    </button>
                  ))}
                  {!calendarItems.length && <p style={{ color: '#64748b', fontSize: 14 }}>No calendar holds captured.</p>}
                </div>
              </div>
            </Card>
            <Card
              style={{
                borderColor: 'rgba(245,158,11,0.22)',
                background: 'linear-gradient(180deg, rgba(26,18,6,0.9), rgba(5,8,14,0.82))',
              }}
            >
              <SectionTitle label="Recurring life checklist" detail={`${recurringDone}/${recurringItems.length} handled today.`} />
              <div style={{ padding: 14, display: 'grid', gap: 8 }}>
                {recurringItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => toggleRecurring(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      minHeight: 34,
                      padding: '7px 9px',
                      border: `1px solid ${item.done ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.07)'}`,
                      borderRadius: 5,
                      background: item.done ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.025)',
                      color: item.done ? '#22c55e' : '#cbd5e1',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ width: 12, height: 12, borderRadius: 5, border: `1px solid ${item.done ? '#22c55e' : '#64748b'}`, background: item.done ? '#22c55e' : 'transparent' }} />
                    <span style={{ fontSize: 14, fontWeight: 750 }}>{item.label}</span>
                  </button>
                ))}
              </div>
            </Card>

            <Card
              style={{
                borderColor: 'rgba(167,139,250,0.22)',
                background: 'linear-gradient(180deg, rgba(17,12,31,0.9), rgba(5,8,14,0.82))',
              }}
            >
              <SectionTitle label="Apple Health ready" detail="Manual tracking now. Watch sync is the next integration." />
              <div style={{ padding: 14, display: 'grid', gap: 10 }}>
                <p style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>
                  The dashboard is already reading manual BP, nutrition, and workout logs. When Apple Health is connected, this panel should replace manual body check data with sleep, heart rate, activity, and workout summaries.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a
                    href="/dashboard/health"
                    style={{
                      height: 32,
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0 12px',
                      borderRadius: 5,
                      border: '1px solid rgba(167,139,250,0.27)',
                      background: 'rgba(167,139,250,0.09)',
                      color: '#a78bfa',
                      fontSize: 13,
                      fontWeight: 850,
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Log health
                  </a>
                  <ActionButton tone="#64748b" onClick={() => saveCloseoutNote(`${closeoutNote}${closeoutNote ? '\n' : ''}Apple Health next: sleep, HR, workouts, BP sync.`)}>
                    Add integration note
                  </ActionButton>
                </div>
              </div>
            </Card>
          </div>

          <Card style={{ borderColor: `${commandTheme.color}33` }}>
            {commandTask ? (
              <div className="dashboard-command-focus-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 240px', gap: 0 }}>
                <div style={{ padding: 22, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: workspaceFor(commandTask)?.color ?? commandTheme.color, fontSize: 13, fontWeight: 900, letterSpacing: '0.1em' }}>
                      {workspaceFor(commandTask)?.name ?? commandTask.brand ?? 'Unassigned'}
                    </span>
                    <span style={{ color: '#cbd5e1', fontSize: 11, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, padding: '2px 8px' }}>{priorityLabel[commandTask.priority]}</span>
                    <span style={{ color: commandTheme.color, fontSize: 11, border: `1px solid ${commandTheme.color}33`, borderRadius: 999, padding: '2px 8px' }}>{commandLane}</span>
                    <span style={{ color: commandTask.status === 'in_progress' ? '#38bdf8' : commandTask.status === 'blocked' ? '#f59e0b' : '#94a3b8', fontSize: 11, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, padding: '2px 8px' }}>
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
                  <p style={{ color: '#9ca9bb', fontSize: 15, lineHeight: 1.55, marginTop: 11 }}>{notePreview(commandTask)}</p>
                  <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.45, marginTop: 8 }}>{inferWhy(commandTask)}</p>

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
                        <p style={{ color: '#7f8da3', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 5 }}>Needle</p>
                      </div>
                    </div>
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.45, textAlign: 'center' }}>
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

          <VideoPipelinePanel />

          <div className="dashboard-focus-tools-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.9fr) minmax(0, 1.1fr)', gap: 12 }}>
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
                      fontSize: 14,
                      boxShadow: '0 0 0 1px rgba(255,255,255,0.02) inset',
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <ActionButton tone="#f472b6" onClick={handleCapture} disabled={!capture.trim() || capturing}>
                      Save idea
                    </ActionButton>
                    <span style={{ color: '#64748b', fontSize: 11, lineHeight: 1.35 }}>
                      {selectedWs ? `Drops into ${selectedWs.name}` : 'Drops into all-workspace ideas'}
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: 12, display: 'grid', gap: 7 }}>
                  {ideas.slice(0, 4).map(item => (
                    <p key={item.id} style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.35, borderTop: '1px solid rgba(244,114,182,0.10)', paddingTop: 7 }}>
                      {item.title}
                    </p>
                  ))}
                  {!ideas.length && <p style={{ color: '#64748b', fontSize: 13 }}>No parked ideas in this scope.</p>}
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
                        fontSize: 14,
                        lineHeight: 1.35,
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                      <span style={{ color: task.status === 'in_progress' ? '#38bdf8' : task.status === 'blocked' ? '#f59e0b' : '#94a3b8', fontSize: 11, fontWeight: 850 }}>
                        {statusLabel[task.status]}
                      </span>
                    </button>
                  )
                }) : (
                  <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.45, padding: 4 }}>No open tasks in this scope.</p>
                )}
              </div>
            </Card>
          </div>

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
                    <span style={{ color: '#f8fafc', fontSize: 15, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
                    <span style={{ marginLeft: 'auto', color: ws.color, fontSize: 13, fontWeight: 850 }}>{count}</span>
                  </div>
                  <p style={{ color: next ? '#94a3b8' : '#64748b', fontSize: 13, lineHeight: 1.4, marginTop: 12, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {next ? next.title : 'Clear for now'}
                  </p>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

    </div>
  )
}
