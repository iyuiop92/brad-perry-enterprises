'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Task, Workspace } from '@/lib/types'
import ParticleField from '@/components/ParticleField'
import InboxStrip from '@/components/InboxStrip'
import WorkspaceTile from '@/components/WorkspaceTile'
import WorkspaceTaskList from '@/components/WorkspaceTaskList'
import AddTaskPanel from '@/components/AddTaskPanel'
import TaskDetailModal from '@/components/TaskDetailModal'

export default function DashboardPage() {
  const [workspaces, setWorkspaces]     = useState<Workspace[]>([])
  const [tasks, setTasks]               = useState<Task[]>([])
  const [loading, setLoading]           = useState(true)
  const [selectedWs, setSelectedWs]     = useState<Workspace | null>(null)
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

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  const myBrands   = workspaces.filter(w => w.type === 'brand')
  const clients    = workspaces.filter(w => w.type === 'client')
  const wsTasks    = selectedWs ? tasks.filter(t => t.workspace_id === selectedWs.id) : []
  const totalActive  = workspaces.reduce((s, w) => s + w.active_count, 0)
  const totalBlocked = workspaces.reduce((s, w) => s + w.blocked_count, 0)
  const totalTasks   = tasks.length

  function handleSelectWs(ws: Workspace) {
    setSelectedWs(prev => prev?.id === ws.id ? null : ws)
  }

  return (
    <>
      <ParticleField />

      {/* Header */}
      <header
        className="shrink-0 relative z-10"
        style={{ background: 'rgba(4,4,10,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-7 py-4">
          <div className="flex items-center gap-3">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: '#00b4ff', boxShadow: '0 0 8px #00b4ff', animation: 'breathe 2.5s ease-in-out infinite', '--glow-color': '#00b4ff88', '--glow-min': '4px', '--glow-max': '12px' } as React.CSSProperties}
            />
            <span
              className="text-base font-[800] tracking-tight"
              style={{ color: '#e2e8f0', fontFamily: 'var(--font-outfit)', letterSpacing: '-0.02em' }}
            >
              BPE <span style={{ color: '#00b4ff' }}>Command Center</span>
            </span>
          </div>
          <div className="flex items-center gap-5">
            <span className="text-xs font-[500]" style={{ color: '#334155' }}>{today}</span>
            <button
              onClick={() => setShowAddPanel(true)}
              className="rounded-[8px] px-4 py-2 text-xs font-[700] tracking-wide transition-all hover:opacity-85"
              style={{ background: '#00b4ff', color: '#04040a', letterSpacing: '0.04em' }}
            >
              + NEW TASK
            </button>
          </div>
        </div>

        {/* Stats bar */}
        {!loading && (
          <div
            className="flex items-center gap-6 px-7 py-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
          >
            <StatChip value={workspaces.length} label="workspaces" />
            <StatChip value={totalTasks} label="total tasks" />
            <StatChip value={totalActive} label="in progress" color="#00b4ff" />
            {totalBlocked > 0 && <StatChip value={totalBlocked} label="blocked" color="#f59e0b" />}
          </div>
        )}
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto relative z-10">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00b4ff] animate-pulse" />
              <span className="text-xs font-[600] tracking-widest uppercase" style={{ color: '#334155' }}>Loading</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-10 px-7 py-8" style={{ maxWidth: 1400, margin: '0 auto' }}>

            <InboxStrip />

            {/* My Brands */}
            <section>
              <SectionLabel text="My Brands" count={myBrands.length} />
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {myBrands.map(ws => (
                  <WorkspaceTile
                    key={ws.id}
                    workspace={ws}
                    selected={selectedWs?.id === ws.id}
                    onSelect={handleSelectWs}
                  />
                ))}
              </div>
            </section>

            {/* Client Work */}
            {clients.length > 0 && (
              <section>
                <SectionLabel text="Client Work" count={clients.length} />
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                  {clients.map(ws => (
                    <WorkspaceTile
                      key={ws.id}
                      workspace={ws}
                      selected={selectedWs?.id === ws.id}
                      onSelect={handleSelectWs}
                    />
                  ))}
                </div>
              </section>
            )}

            {selectedWs && (
              <WorkspaceTaskList
                workspace={selectedWs}
                tasks={wsTasks}
                onSelectTask={setSelectedTask}
                onAddTask={() => setShowAddPanel(true)}
              />
            )}

          </div>
        )}
      </main>

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

function StatChip({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-sm font-[800]" style={{ color: color ?? '#475569', fontFamily: 'var(--font-outfit)' }}>
        {value}
      </span>
      <span className="text-[10px] font-[500] uppercase tracking-wider" style={{ color: '#283044' }}>
        {label}
      </span>
    </div>
  )
}

function SectionLabel({ text, count }: { text: string; count: number }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.04)' }} />
      <span className="text-[10px] font-[700] uppercase tracking-[0.25em]" style={{ color: '#283044' }}>
        {text}
      </span>
      <span
        className="text-[9px] font-[700] px-1.5 py-0.5 rounded-full"
        style={{ background: 'rgba(255,255,255,0.04)', color: '#334155' }}
      >
        {count}
      </span>
      <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.04)' }} />
    </div>
  )
}
