'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Task, Workspace } from '@/lib/types'
import ParticleField from '@/components/ParticleField'
import ActionHub from '@/components/ActionHub'
import InitiativeGrid from '@/components/InitiativeGrid'
import BrandPanel from '@/components/BrandPanel'
import BrandFooterBar from '@/components/BrandFooterBar'
import TaskDetailModal from '@/components/TaskDetailModal'
import AddTaskPanel from '@/components/AddTaskPanel'

function computeMetrics(tasks: Task[]) {
  const total = tasks.length
  const active = tasks.filter(t => t.status === 'in_progress').length
  const blocked = tasks.filter(t => t.status === 'blocked').length
  const done = tasks.filter(t => t.status === 'done').length
  const completionPct = total > 0 ? Math.round((done / total) * 100) : 0
  const velocityPct = total > 0 ? Math.round(((active + done) / total) * 100) : 0
  const focusScore = Math.min(100, Math.max(0,
    40 +
    Math.min(40, active * 8) -
    Math.min(30, blocked * 10) +
    Math.min(20, Math.floor(completionPct / 5))
  ))
  return { completionPct, velocityPct, focusScore }
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <span
        className="text-[9px] font-[700] uppercase tracking-[0.14em] shrink-0"
        style={{ color: '#334155' }}
      >
        {label}
      </span>
      <div className="flex-1 h-px rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
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

  const { completionPct, velocityPct, focusScore } = computeMetrics(tasks)
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })

  return (
    <>
      <ParticleField />

      {/* ── Header ── */}
      <header
        className="shrink-0 relative z-10"
        style={{
          background: 'rgba(4,4,10,0.94)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Top bar */}
        <div className="flex items-center gap-4 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{
                background: '#00b4ff',
                boxShadow: '0 0 10px #00b4ff',
                animation: 'breathe 2.5s ease-in-out infinite',
                '--glow-color': '#00b4ff88',
                '--glow-min': '5px',
                '--glow-max': '14px',
              } as React.CSSProperties}
            />
            <span
              className="text-base font-[800] tracking-tight"
              style={{ color: '#e2e8f0', fontFamily: 'var(--font-outfit)', letterSpacing: '-0.02em' }}
            >
              BPE <span style={{ color: '#00b4ff' }}>Command Center</span>
            </span>
          </div>

          {/* Focus Score */}
          {!loading && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg shrink-0"
              style={{ background: 'rgba(0,180,255,0.06)', border: '1px solid rgba(0,180,255,0.18)' }}
            >
              <span className="text-[9px] font-[600] uppercase tracking-wider" style={{ color: '#334155' }}>
                Focus Score
              </span>
              <span className="text-sm font-[800]" style={{ color: '#00b4ff' }}>
                {focusScore}
                <span className="text-[9px] font-[500]" style={{ color: '#334155' }}>/100</span>
              </span>
            </div>
          )}

          <div className="flex-1" />

          <span className="text-xs font-[500] shrink-0" style={{ color: '#283044' }}>
            Today: {today}
          </span>
          <button
            onClick={() => setShowAddPanel(true)}
            className="shrink-0 rounded-lg px-4 py-2 text-xs font-[700] tracking-wide transition-opacity hover:opacity-85"
            style={{ background: '#00b4ff', color: '#04040a', letterSpacing: '0.04em' }}
          >
            + NEW INITIATIVE
          </button>
        </div>

        {/* Metrics bar */}
        {!loading && (
          <div
            className="flex items-center gap-5 px-5 py-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
          >
            <MetricBar label="Global Velocity" value={velocityPct} color="#00b4ff" />
            <div className="w-px h-3 shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <MetricBar label="Overall Completion" value={completionPct} color="#22c55e" />
            <div className="w-px h-3 shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <MetricBar label="Projected ROI" value={Math.min(100, focusScore + 12)} color="#8b5cf6" />
          </div>
        )}
      </header>

      {/* ── Three-panel body ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#00b4ff' }} />
            <span className="text-xs font-[600] tracking-widest uppercase" style={{ color: '#334155' }}>
              Initializing
            </span>
          </div>
        </div>
      ) : (
        <div className="flex relative z-10" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Left: Action Hub */}
          <aside style={{ width: 272, flexShrink: 0 }}>
            <ActionHub
              tasks={tasks}
              onSelectTask={setSelectedTask}
              onAddTask={() => setShowAddPanel(true)}
            />
          </aside>

          {/* Center: Initiative Grid */}
          <main style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <InitiativeGrid
              workspaces={workspaces}
              tasks={tasks}
              selectedWs={selectedWs}
              onSelectWs={ws => setSelectedWs(prev => prev?.id === ws.id ? null : ws)}
            />
          </main>

          {/* Right: Brand Panel */}
          <aside style={{ width: 308, flexShrink: 0 }}>
            <BrandPanel
              workspace={selectedWs}
              tasks={tasks}
              workspaces={workspaces}
              onSelectWs={setSelectedWs}
              onSelectTask={setSelectedTask}
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
