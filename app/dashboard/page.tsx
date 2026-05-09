'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { Task, Workspace } from '@/lib/types'
import ParticleField from '@/components/ParticleField'
import ActionHub from '@/components/ActionHub'
import NeuralGraph from '@/components/NeuralGraph'
import WendyPanel from '@/components/WendyPanel'
import BrandFooterBar from '@/components/BrandFooterBar'
import TaskDetailModal from '@/components/TaskDetailModal'
import AddTaskPanel from '@/components/AddTaskPanel'

const STATUS_MESSAGES = [
  'Systems Operational',
  'Wendy AI Connected',
  'Neural Grid Active',
  'Revenue Pulse Stable',
]

function buildStatusMessages(tasks: Task[], workspaces: Workspace[]): string[] {
  const active = tasks.filter(t => t.status === 'in_progress').length
  const blocked = tasks.filter(t => t.status === 'blocked').length
  return [
    'Systems Operational',
    `${active} Active Initiative${active !== 1 ? 's' : ''}`,
    blocked > 0 ? `${blocked} Item${blocked !== 1 ? 's' : ''} Need Attention` : 'No Critical Blockers',
    'Wendy AI Connected',
    `${workspaces.length} Workspace${workspaces.length !== 1 ? 's' : ''} Online`,
    'Revenue Pulse Stable',
  ]
}

function computeMetrics(tasks: Task[]) {
  const total = tasks.length
  const active = tasks.filter(t => t.status === 'in_progress').length
  const blocked = tasks.filter(t => t.status === 'blocked').length
  const done = tasks.filter(t => t.status === 'done').length
  const completionPct = total > 0 ? Math.round((done / total) * 100) : 0
  const velocityPct = total > 0 ? Math.round(((active + done) / total) * 100) : 0
  const focusScore = Math.min(100, Math.max(0,
    40 + Math.min(40, active * 8) - Math.min(30, blocked * 10) + Math.min(20, Math.floor(completionPct / 5))
  ))
  return { completionPct, velocityPct, focusScore, active, blocked, done, total }
}

function AnimatedCounter({ target, color }: { target: number; color?: string }) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (target === 0) { setValue(0); return }
    const step = Math.ceil(target / 20)
    let current = 0
    const t = setInterval(() => {
      current = Math.min(target, current + step)
      setValue(current)
      if (current >= target) clearInterval(t)
    }, 40)
    return () => clearInterval(t)
  }, [target])
  return <span style={{ color: color ?? '#475569' }}>{value}</span>
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <span className="text-[9px] font-[700] uppercase tracking-[0.14em] shrink-0" style={{ color: '#334155' }}>
        {label}
      </span>
      <div className="flex-1 h-px rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="text-xs font-[800] shrink-0" style={{ color }}>{value}%</span>
    </div>
  )
}

export default function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [tasks, setTasks]           = useState<Task[]>([])
  const [loading, setLoading]       = useState(true)
  const [selectedWs, setSelectedWs] = useState<Workspace | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [statusIdx, setStatusIdx] = useState(0)
  const [statusVisible, setStatusVisible] = useState(true)

  const fetchAll = useCallback(async () => {
    const [wsRes, taskRes] = await Promise.all([
      fetch('/api/workspaces'),
      fetch('/api/tasks'),
    ])
    if (wsRes.ok)   setWorkspaces(await wsRes.json())
    if (taskRes.ok) setTasks(await taskRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Rotating status text
  const statusMessages = loading ? STATUS_MESSAGES : buildStatusMessages(tasks, workspaces)
  useEffect(() => {
    const interval = setInterval(() => {
      setStatusVisible(false)
      setTimeout(() => {
        setStatusIdx(i => (i + 1) % statusMessages.length)
        setStatusVisible(true)
      }, 300)
    }, 3200)
    return () => clearInterval(interval)
  }, [statusMessages.length])

  const { completionPct, velocityPct, focusScore, active, blocked, total } = computeMetrics(tasks)
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <>
      <ParticleField />

      {/* ── Header ── */}
      <header
        className="shrink-0 relative z-10"
        style={{
          background: 'rgba(5,7,10,0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0,180,255,0.08)',
          boxShadow: '0 1px 0 rgba(0,180,255,0.04)',
        }}
      >
        {/* Top bar */}
        <div className="flex items-center gap-4 px-5 py-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{
                background: '#00b4ff',
                boxShadow: '0 0 12px #00b4ff',
                animation: 'breathe 2.5s ease-in-out infinite',
                '--glow-color': '#00b4ff88',
                '--glow-min': '5px',
                '--glow-max': '16px',
              } as React.CSSProperties}
            />
            <span
              className="text-base font-[800] tracking-tight"
              style={{ color: '#e2e8f0', fontFamily: 'var(--font-outfit)', letterSpacing: '-0.02em' }}
            >
              BPE <span style={{ color: '#00b4ff' }}>Command Center</span>
            </span>
          </div>

          {/* Rotating status */}
          <div className="flex-1 flex justify-center">
            <div
              className="text-[10px] font-[600] tracking-[0.15em] uppercase transition-all duration-300"
              style={{
                color: '#334155',
                opacity: statusVisible ? 1 : 0,
                transform: statusVisible ? 'translateY(0)' : 'translateY(-4px)',
              }}
            >
              {statusMessages[statusIdx]}
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3 shrink-0">
            {!loading && (
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(0,180,255,0.06)', border: '1px solid rgba(0,180,255,0.15)' }}
              >
                <span className="text-[9px] font-[600] uppercase tracking-wider" style={{ color: '#334155' }}>
                  Focus
                </span>
                <span className="text-sm font-[800]" style={{ color: '#00b4ff' }}>
                  {focusScore}
                  <span className="text-[9px] font-[500]" style={{ color: '#334155' }}>/100</span>
                </span>
              </div>
            )}
            <span className="text-xs font-[500]" style={{ color: '#283044' }}>
              {today}
            </span>
            <button
              onClick={() => setShowAddPanel(true)}
              className="rounded-lg px-4 py-2 text-xs font-[700] tracking-wide transition-opacity hover:opacity-85"
              style={{ background: '#00b4ff', color: '#04040a', letterSpacing: '0.04em' }}
            >
              + NEW INITIATIVE
            </button>
          </div>
        </div>

        {/* Stats + metrics strip */}
        {!loading && (
          <div
            className="flex items-center gap-5 px-5 py-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
          >
            {/* Animated counters */}
            <div className="flex items-center gap-4 shrink-0">
              {[
                { label: 'workspaces', val: workspaces.length, color: '#475569' },
                { label: 'tasks', val: total, color: '#475569' },
                { label: 'active', val: active, color: '#00b4ff' },
                ...(blocked > 0 ? [{ label: 'blocked', val: blocked, color: '#f59e0b' }] : []),
              ].map(({ label, val, color }) => (
                <div key={label} className="flex items-baseline gap-1">
                  <span className="text-sm font-[800]" style={{ fontFamily: 'var(--font-outfit)' }}>
                    <AnimatedCounter target={val} color={color} />
                  </span>
                  <span className="text-[9px] font-[500] uppercase tracking-wider" style={{ color: '#283044' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <div className="w-px h-3 shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />

            {/* Metric bars */}
            <MetricBar label="Velocity" value={velocityPct} color="#00b4ff" />
            <div className="w-px h-3 shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <MetricBar label="Completion" value={completionPct} color="#22c55e" />
            <div className="w-px h-3 shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <MetricBar label="ROI Index" value={Math.min(100, focusScore + 12)} color="#8b5cf6" />
          </div>
        )}
      </header>

      {/* ── Three-panel body ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center relative z-10">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: '#00b4ff', animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <span className="text-xs font-[600] tracking-widest uppercase" style={{ color: '#334155' }}>
              Initializing Command Center
            </span>
          </div>
        </div>
      ) : (
        <div className="flex relative z-10" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Left: Action Hub */}
          <aside style={{ width: 264, flexShrink: 0 }}>
            <ActionHub
              tasks={tasks}
              onSelectTask={setSelectedTask}
              onAddTask={() => setShowAddPanel(true)}
            />
          </aside>

          {/* Center: Neural Graph */}
          <main
            style={{
              flex: 1,
              minWidth: 0,
              position: 'relative',
              borderLeft: '1px solid rgba(255,255,255,0.04)',
              borderRight: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            {/* Subtle center label */}
            <div
              className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
            >
              <p
                className="text-[9px] font-[700] uppercase tracking-[0.3em]"
                style={{ color: 'rgba(0,180,255,0.2)' }}
              >
                Neural Command Grid
              </p>
            </div>

            <NeuralGraph
              workspaces={workspaces}
              selectedWs={selectedWs}
              onSelectWs={ws => setSelectedWs(ws)}
            />
          </main>

          {/* Right: Wendy Panel */}
          <aside style={{ width: 320, flexShrink: 0 }}>
            <WendyPanel
              workspaces={workspaces}
              tasks={tasks}
              selectedWs={selectedWs}
            />
          </aside>
        </div>
      )}

      {/* ── Footer: Brand KPI bar ── */}
      <BrandFooterBar workspaces={workspaces} onSelectWs={setSelectedWs} />

      {/* ── Modals ── */}
      {showAddPanel && (
        <AddTaskPanel
          onClose={() => setShowAddPanel(false)}
          onTaskAdded={() => { setShowAddPanel(false); fetchAll() }}
          defaultBrand={selectedWs?.name}
          defaultWorkspaceId={selectedWs?.id}
        />
      )}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSaved={() => fetchAll()}
          onDeleted={() => { setSelectedTask(null); fetchAll() }}
        />
      )}
    </>
  )
}
