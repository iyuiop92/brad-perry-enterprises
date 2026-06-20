'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Task, Workspace } from '@/lib/types'
import ParticleField from '@/components/ParticleField'
import CommandFeed from '@/components/CommandFeed'
import WendyPanel from '@/components/WendyPanel'
import TaskDetailModal from '@/components/TaskDetailModal'
import AddTaskPanel from '@/components/AddTaskPanel'
import AddWorkspacePanel from '@/components/AddWorkspacePanel'
import PersonalFeed from '@/components/PersonalFeed'

export default function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [tasks, setTasks]           = useState<Task[]>([])
  const [loading, setLoading]       = useState(true)
  const [selectedWs, setSelectedWs] = useState<Workspace | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [showAddWorkspace, setShowAddWorkspace] = useState(false)
  const [wendyOpen, setWendyOpen]   = useState(false)

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && wendyOpen) setWendyOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [wendyOpen])

  return (
    <div className="dashboard-page-shell" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <ParticleField />

      {/* ── Header ── */}
      <header
        style={{
          height: 44, flexShrink: 0, position: 'relative', zIndex: 20,
          display: 'flex', alignItems: 'center', padding: '0 20px',
          background: 'rgba(5,7,10,0.97)',
          borderBottom: '1px solid rgba(0,180,255,0.07)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div style={{ flex: 1 }} />

        {/* Wendy toggle */}
        <button
          onClick={() => setWendyOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            height: 28, padding: '0 12px', borderRadius: 7, marginRight: 10, cursor: 'pointer',
            background: wendyOpen ? 'rgba(0,180,255,0.1)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${wendyOpen ? 'rgba(0,180,255,0.3)' : 'rgba(255,255,255,0.07)'}`,
            boxShadow: wendyOpen ? '0 0 16px rgba(0,180,255,0.15), inset 0 0 12px rgba(0,180,255,0.05)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          <div
            style={{
              width: 6, height: 6, borderRadius: '50%', background: '#00b4ff',
              boxShadow: '0 0 8px rgba(0,180,255,0.8), 0 0 16px rgba(0,180,255,0.4)',
              animation: 'breathe 2s ease-in-out infinite',
              '--glow-color': 'rgba(0,180,255,0.5)',
              '--glow-min': '4px',
              '--glow-max': '12px',
            } as React.CSSProperties}
          />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#00b4ff', letterSpacing: '0.05em' }}>
            Wendy
          </span>
        </button>

        {/* New */}
        <button
          onClick={() => setShowAddPanel(true)}
          style={{
            height: 28, padding: '0 14px', borderRadius: 7, cursor: 'pointer',
            background: '#00b4ff', color: '#04040a',
            fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
            border: 'none',
            boxShadow: '0 0 14px rgba(0,180,255,0.45), 0 0 30px rgba(0,180,255,0.15)',
          }}
        >
          + NEW
        </button>
      </header>

      {/* ── Personal Feed ── */}
      <PersonalFeed />

      {/* ── Body ── */}
      <main className="dashboard-page-main" style={{ flex: 1, minHeight: 0, position: 'relative', zIndex: 10, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="animate-pulse"
                    style={{
                      width: 6, height: 6, borderRadius: '50%', background: '#00b4ff',
                      boxShadow: '0 0 8px rgba(0,180,255,0.6)',
                      animationDelay: `${i * 0.15}s`,
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.15em', color: '#334155', textTransform: 'uppercase' }}>
                Initializing
              </span>
            </div>
          </div>
        ) : (
          <CommandFeed
            tasks={tasks}
            workspaces={workspaces}
            selectedWs={selectedWs}
            onSelectTask={setSelectedTask}
            onSelectWs={ws => setSelectedWs(prev => prev?.id === ws.id ? null : ws)}
            onAddTask={() => setShowAddPanel(true)}
            onAddWorkspace={() => setShowAddWorkspace(true)}
            onRefresh={fetchAll}
          />
        )}
      </main>

      {/* ── Wendy drawer (slides in from right) ── */}
      <div
        style={{
          position: 'fixed', top: 44, right: 0, bottom: 0, width: 320, zIndex: 50,
          transform: wendyOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          background: 'rgba(4,4,10,0.98)',
          borderLeft: '1px solid rgba(0,180,255,0.12)',
          boxShadow: wendyOpen
            ? '-30px 0 80px rgba(0,0,0,0.7), -8px 0 20px rgba(0,180,255,0.05)'
            : 'none',
        }}
      >
        <WendyPanel workspaces={workspaces} tasks={tasks} selectedWs={selectedWs} />
      </div>

      {/* Backdrop */}
      {wendyOpen && (
        <div
          onClick={() => setWendyOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(0,0,0,0.25)',
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* ── Modals ── */}
      {showAddPanel && (
        <AddTaskPanel
          onClose={() => setShowAddPanel(false)}
          onTaskAdded={() => { setShowAddPanel(false); fetchAll() }}
          defaultBrand={selectedWs?.name}
          defaultWorkspaceId={selectedWs?.id}
        />
      )}
      {showAddWorkspace && (
        <AddWorkspacePanel
          onClose={() => setShowAddWorkspace(false)}
          onAdded={() => { setShowAddWorkspace(false); fetchAll() }}
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
    </div>
  )
}
